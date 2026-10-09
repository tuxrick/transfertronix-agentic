/**
 * Gemini AI Agent with Function Calling
 *
 * El agente interpreta lo que pide el usuario y decide qué acción tomar.
 * Nunca ejecuta un cargo: cada compra termina en la página de aprobación de Reap.
 */

import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
} from '@google/generative-ai';
import type {Contact} from '../types/contact';
import type {PurchaseRequest} from '../types/purchaseRequest';
import {config} from '../config';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_purchase_request',
    description:
      'Registra que alguien necesita algo y busca opciones para comprarlo. ' +
      'Úsala cuando el usuario pide comprar o enviar un artículo a un contacto o para sí mismo.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        item_description: {
          type: SchemaType.STRING,
          description: 'Qué se necesita, en términos de búsqueda de producto (ej: "pañales talla 3 paquete grande")',
        },
        contact: {
          type: SchemaType.STRING,
          description: 'Nombre o nickname del contacto que recibirá la compra. Omitir si es para el propio usuario.',
        },
        max_amount: {
          type: SchemaType.NUMBER,
          description: 'Tope de gasto mencionado por el usuario. Omitir si no lo dijo.',
        },
        currency: {
          type: SchemaType.STRING,
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
      type: SchemaType.OBJECT,
      properties: {
        contact: {
          type: SchemaType.STRING,
          description: 'Nombre o nickname del contacto cuya solicitud se va a atender',
        },
      },
      required: ['contact'],
    },
  },
  {
    name: 'list_purchase_requests',
    description: 'Lista las solicitudes de compra del usuario y su estado.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: 'open (pendientes o en curso), completed, o all',
        },
      },
    },
  },
];

export interface AIContext {
  contacts: Contact[];
  openRequests: PurchaseRequest[];
  hasPaymentMethod: boolean;
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface AIResponse {
  text: string;
  functionCall?: FunctionCall;
}

function buildSystemPrompt(context: AIContext): string {
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

  return `Eres Transfertronix, un agente que compra cosas por el usuario y para sus contactos (familia, equipo o amigos).
Los pagos se hacen con Reap: tú buscas y cotizas, y el usuario SIEMPRE aprueba el cargo final en una página segura.
Nunca pidas ni manejes datos de tarjeta.

CONTACTOS:
${contactsInfo || 'Sin contactos'}

SOLICITUDES ABIERTAS:
${requestsInfo || 'Ninguna'}

MÉTODO DE PAGO: ${context.hasPaymentMethod ? 'configurado' : 'no configurado (sugiere agregarlo desde el botón 💳)'}

Reglas:
- Si el usuario pide comprar o mandar algo, llama create_purchase_request.
- Si menciona atender o pagar lo que pidió un contacto, llama fulfill_purchase_request.
- Si pregunta por sus pedidos o solicitudes, llama list_purchase_requests.
- No ofrezcas viajes, apuestas ni contenido para adultos.
- Responde en español, breve y amigable.`;
}

/**
 * Procesa un mensaje del usuario y devuelve texto o una llamada a función.
 */
export async function processMessageWithAI(
  userMessage: string,
  context: AIContext,
  history: Content[] = [],
): Promise<AIResponse> {
  try {
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: buildSystemPrompt(context),
      tools: [{functionDeclarations}],
    });

    const chat = model.startChat({
      history,
      generationConfig: {temperature: 0.4, maxOutputTokens: 1024},
    });

    const result = await chat.sendMessage(userMessage);
    const [call] = result.response.functionCalls() || [];

    if (call) {
      return {text: '', functionCall: {name: call.name, args: (call.args as Record<string, any>) || {}}};
    }
    return {text: result.response.text()};
  } catch (error: any) {
    console.error('Error processing message with Gemini:', error?.message);
    return {
      text:
        'No pude conectarme con el asistente. 🤔\n\n' +
        'Intenta de nuevo en un momento, o usa los botones 📋 👥 💳 de arriba.',
    };
  }
}
