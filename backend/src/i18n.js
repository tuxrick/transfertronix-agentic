/**
 * Error messages in the user's language (Accept-Language: es | en).
 * Errors carry a code and params; the message is rendered when responding.
 */

const MESSAGES = {
  es: {
    NO_PAYMENT_METHOD: 'Agrega una tarjeta en Métodos de pago antes de comprar',
    MERCHANT_NOT_SUPPORTED: 'Solo se puede comprar en comercios de la lista soportada',
    QUOTE_EXPIRED: 'La cotización expiró, vuelve a cotizar',
    BUDGET_CURRENCY_MISMATCH: 'El tope está en {capCurrency} y la cotización en {quoteCurrency}; define el tope en {quoteCurrency}',
    BUDGET_EXCEEDED: 'El total ({total} {currency}) excede el tope autorizado ({cap} {capCurrency})',
    INSUFFICIENT_FUNDS: 'La bóveda necesita {amount} {currency} más para esta compra',
    VAULT_NOT_READY: 'La bóveda no está lista para pagar ({state})',
    VARIANT_NOT_PURCHASABLE: 'Ese producto no tiene una variante disponible para comprar',
    UNSUPPORTED_FOR_PROVIDER: 'Kwal no soporta carritos por URL; usa la búsqueda de productos',
    SETUP_WITH_SKILL: 'La bóveda de Kwal se configura con el skill agent-payment en Claude Code (ver README)',
    MISSING_TOKEN: 'Falta el token de sesión',
    INVALID_SESSION: 'Sesión inválida o expirada',
    INTERNAL_ERROR: 'Error interno del servidor',
  },
  en: {
    NO_PAYMENT_METHOD: 'Add a card in Payment methods before buying',
    MERCHANT_NOT_SUPPORTED: 'Purchases are only allowed at merchants on the supported list',
    QUOTE_EXPIRED: 'The quote expired, please quote again',
    BUDGET_CURRENCY_MISMATCH: 'The cap is in {capCurrency} and the quote is in {quoteCurrency}; set the cap in {quoteCurrency}',
    BUDGET_EXCEEDED: 'The total ({total} {currency}) exceeds the authorized cap ({cap} {capCurrency})',
    INSUFFICIENT_FUNDS: 'The vault needs {amount} {currency} more for this purchase',
    VAULT_NOT_READY: 'The vault is not ready to pay ({state})',
    VARIANT_NOT_PURCHASABLE: 'That product has no variant available to buy',
    UNSUPPORTED_FOR_PROVIDER: 'Kwal does not support cart URLs; use product search instead',
    SETUP_WITH_SKILL: 'The Kwal vault is set up with the agent-payment skill in Claude Code (see README)',
    MISSING_TOKEN: 'Missing session token',
    INVALID_SESSION: 'Invalid or expired session',
    INTERNAL_ERROR: 'Internal server error',
  },
};

function languageOf(req) {
  return /^en\b/i.test(req.get('Accept-Language') || '') ? 'en' : 'es';
}

function message(lang, key, params = {}) {
  const template = MESSAGES[lang][key] || MESSAGES.es[key];
  if (!template) return null;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

module.exports = { languageOf, message };
