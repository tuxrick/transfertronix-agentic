/**
 * Reapli: the Gemini shopping agent, run server-side so the API key never ships in the app.
 * The app sends the message, its context and recent history; Reapli answers with text
 * or with a function call that the app executes (search, quote, checkout, language...).
 */
const { config } = require('../config');
const { httpError } = require('../middleware/errors');

const FUNCTION_DECLARATIONS = [
  {
    name: 'create_purchase_request',
    description:
      'Registra que alguien necesita algo y busca opciones para comprarlo. ' +
      'Úsala cuando el usuario pide comprar o enviar un artículo a un contacto o para sí mismo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_description: {
          type: 'STRING',
          description: 'Qué se necesita, en términos de búsqueda de producto (ej: "teclado inalámbrico low-profile")',
        },
        contact: {
          type: 'STRING',
          description: 'Nombre o nickname del contacto que recibirá la compra. Omitir si es para el propio usuario.',
        },
        max_amount: {
          type: 'NUMBER',
          description: 'Tope de gasto mencionado por el usuario. Omitir si no lo dijo.',
        },
        currency: {
          type: 'STRING',
          description: 'Código ISO de moneda del tope (MXN, USD...). Por defecto MXN.',
        },
      },
      required: ['item_description'],
    },
  },
  {
    name: 'fulfill_purchase_request',
    description: 'Retoma una solicitud de compra pendiente de un contacto para buscar opciones y pagarla.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact: {
          type: 'STRING',
          description: 'Nombre o nickname del contacto cuya solicitud se va a atender',
        },
      },
      required: ['contact'],
    },
  },
  {
    name: 'set_language',
    description:
      'Cambia el idioma de la app y de la conversación. Úsala cuando el usuario pida hablar en otro idioma ' +
      '(ej: "speak English", "habla en español", "cambia a inglés").',
    parameters: {
      type: 'OBJECT',
      properties: {
        language: {
          type: 'STRING',
          description: 'Idioma destino: "es" para español o "en" para inglés',
        },
      },
      required: ['language'],
    },
  },
  {
    name: 'list_purchase_requests',
    description: 'Lista las solicitudes de compra del usuario y su estado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          description: 'open (pendientes o en curso), completed, o all',
        },
      },
    },
  },
];

const PROVIDER_DESCRIPTIONS = {
  reap: 'Reap Agentic Payments: el usuario aprueba cada cargo en una página segura de Reap',
  kwal: 'Kwal: la tarjeta de Reapli está respaldada por USDC en la bóveda del usuario (Ink Sepolia)',
};

function buildSystemPrompt(context) {
  const contactsInfo = context.contacts
    .map(c => {
      const parts = [`- ${c.name}`];
      if (c.nickname) parts.push(`(nickname: "${c.nickname}")`);
      if (c.city) parts.push(`· vive en ${c.city}, ${c.country}`);
      if (c.spend_limit) parts.push(`· tope por compra ${c.spend_limit} ${c.currency}`);
      return parts.join(' ');
    })
    .join('\n');

  const requestsInfo = context.openRequests
    .map(r => `- ${r.contact_name || 'Tú'}: ${r.item_description} (${r.status})`)
    .join('\n');

  const catalogInfo = context.shippingCatalog
    .map(c => `- Envíos a ${c.country}: ${c.categories.join(', ')}`)
    .join('\n');

  return `Eres Reapli, el agente de compras de la app Transfertronix. Compras cosas por el usuario y para sus contactos (familia, equipo o amigos).
Tu nombre es Reapli; si te preguntan quién eres, preséntate así.
Pagos: ${context.provider ? PROVIDER_DESCRIPTIONS[context.provider] : 'no disponible'}.
Tú buscas y cotizas; el usuario confirma cada compra. Nunca pidas ni manejes datos de tarjeta.

CONTACTOS:
${contactsInfo || 'Sin contactos'}

SOLICITUDES ABIERTAS:
${requestsInfo || 'Ninguna'}

COMERCIOS COMPATIBLES POR PAÍS DE ENVÍO (solo se puede comprar aquí):
${catalogInfo || 'Sin datos'}

MÉTODO DE PAGO: ${context.hasPaymentMethod ? 'listo' : 'no listo (sugiere revisarlo desde el botón 💳)'}

Reglas:
- Si el usuario pide comprar o mandar algo, llama create_purchase_request.
- Si menciona atender o pagar lo que pidió un contacto, llama fulfill_purchase_request.
- Si pregunta por sus pedidos o solicitudes, llama list_purchase_requests.
- Si pide hablar en otro idioma (inglés o español), llama set_language.
- Si lo que piden no está en las categorías que envían al país del contacto, dilo y sugiere algo que sí esté.
- Fuera de alcance: viajes, apuestas, contenido para adultos y categorías restringidas.
- Idioma actual de la conversación: ${context.language === 'en' ? 'inglés (English)' : 'español'}. Responde SIEMPRE en ese idioma, breve y amigable.
- Al llamar create_purchase_request, escribe item_description en el idioma en que el usuario lo pidió.`;
}

const MAX_HISTORY_TURNS = 20;

function toContents(history, message) {
  const turns = (Array.isArray(history) ? history : [])
    .filter(t => (t.role === 'user' || t.role === 'model') && typeof t.text === 'string' && t.text.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map(t => ({ role: t.role, parts: [{ text: t.text }] }));
  const firstUser = turns.findIndex(t => t.role === 'user');
  return [...(firstUser === -1 ? [] : turns.slice(firstUser)), { role: 'user', parts: [{ text: message }] }];
}

function normalizeContext(context = {}) {
  return {
    contacts: Array.isArray(context.contacts) ? context.contacts : [],
    openRequests: Array.isArray(context.openRequests) ? context.openRequests : [],
    shippingCatalog: Array.isArray(context.shippingCatalog) ? context.shippingCatalog : [],
    hasPaymentMethod: Boolean(context.hasPaymentMethod),
    provider: context.provider,
    language: context.language === 'en' ? 'en' : 'es',
  };
}

async function askReapli({ message, history, context }) {
  if (!config.gemini.apiKey) {
    throw httpError(503, 'AGENT_NOT_CONFIGURED', 'GEMINI_API_KEY is not configured');
  }
  const ctx = normalizeContext(context);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(ctx) }] },
      contents: toContents(history, message),
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Gemini ${response.status}: ${data?.error?.message}`);
    throw httpError(502, 'AGENT_UNAVAILABLE', 'The agent is unavailable');
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const call = parts.find(p => p.functionCall)?.functionCall;
  if (call) return { text: '', functionCall: { name: call.name, args: call.args || {} } };
  return { text: parts.map(p => p.text || '').join('').trim() };
}

module.exports = { askReapli };
