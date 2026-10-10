/**
 * Kwal (Payward) adapter: the agent pays with a sandbox card backed by a
 * USDC vault on Ink Sepolia. One team participant funds every purchase.
 * Kwal prices in USD and settles 1 USD = 1 USDC.
 */
const { randomUUID } = require('node:crypto');
const { kwalRequest } = require('../kwal/client');
const { config } = require('../config');
const { httpError } = require('../middleware/errors');

const name = 'kwal';

const STATE_TO_STATUS = {
  REQUIRES_ACTION: 'REQUIRES_ACTION',
  PENDING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  DECLINED: 'FAILED',
  ERROR: 'FAILED',
};

function toMoney(amount) {
  if (!amount?.currency) return undefined;
  const decimals = amount.decimals ?? (amount.currency === 'USDC' ? 6 : 2);
  return { amount: Number(amount.minorUnits || 0) / 10 ** decimals, currency: amount.currency };
}

function shortState(value, prefix) {
  return typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function normalizeQuote(quote) {
  return {
    id: quote.quoteId,
    subtotal: toMoney(quote.subtotal),
    shipping: toMoney(quote.shipping),
    tax: toMoney(quote.tax),
    discounts: [],
    total: toMoney(quote.total),
    expiresAt: quote.expiresAtUnixSeconds ? new Date(Number(quote.expiresAtUnixSeconds) * 1000).toISOString() : undefined,
    shippingOptions: (quote.shippingOptions || []).map(o => ({
      id: o.shippingOptionId,
      name: o.label,
      price: toMoney(o.price),
      selected: o.shippingOptionId === quote.selectedShippingOptionId,
    })),
  };
}

function normalizePayment(payment) {
  const state = shortState(payment.state, 'PARTICIPANT_PAYMENT_STATE_');
  return {
    id: payment.paymentId,
    status: STATE_TO_STATUS[state] || 'PROCESSING',
    approvalUrl: payment.approvalUrl,
    approvalExpiresAt: payment.approvalExpiresAtUnixSeconds
      ? new Date(Number(payment.approvalExpiresAtUnixSeconds) * 1000).toISOString()
      : undefined,
    orderId: payment.orderId,
    total: toMoney(payment.charged) || toMoney(payment.amount),
    reason: payment.reason,
    step: payment.step,
  };
}

async function searchProducts({ query, limit = 10 }) {
  const body = await kwalRequest('GET', '/products', { query: { query, limit } });
  return {
    products: (body?.products || []).map(p => ({
      id: p.productId,
      name: p.title,
      merchant: p.merchant,
      price: toMoney(p.price),
      source: 'search',
    })),
    warnings: [],
  };
}

async function resolveVariant(productId) {
  const variant = await kwalRequest('POST', `/products/${encodeURIComponent(productId)}/variant`, {
    body: { optionIds: [] },
  });
  if (!variant?.purchasable) {
    throw httpError(422, 'VARIANT_NOT_PURCHASABLE', 'Ese producto necesita elegir opciones (talla, color...)');
  }
  return variant.variantId;
}

async function createQuote({ productId, variantId, quantity = 1, externalCheckout, email, shippingAddress }) {
  if (externalCheckout) {
    throw httpError(422, 'UNSUPPORTED_FOR_PROVIDER', 'Kwal no soporta carritos por URL; usa la búsqueda de productos');
  }
  const resolvedVariantId = variantId || (await resolveVariant(productId));
  const quote = await kwalRequest('POST', '/quotes', {
    body: {
      email,
      lines: [{ variantId: resolvedVariantId, quantity }],
      ...(shippingAddress && { shippingAddress }),
    },
  });
  return normalizeQuote(quote);
}

async function getQuote(id) {
  return normalizeQuote(await kwalRequest('GET', `/quotes/${encodeURIComponent(id)}`));
}

async function selectShipping(quoteId, shippingOptionId) {
  const current = await kwalRequest('GET', `/quotes/${encodeURIComponent(quoteId)}`);
  // Re-posting the already selected option is rejected by the provider.
  if (current.selectedShippingOptionId === shippingOptionId) return normalizeQuote(current);
  return normalizeQuote(
    await kwalRequest('POST', `/quotes/${encodeURIComponent(quoteId)}/shipping`, { body: { shippingOptionId } }),
  );
}

async function getFunding(quoteId) {
  return kwalRequest('GET', '/funding', { query: quoteId ? { quoteId } : {} });
}

async function createCheckout({ quoteId }) {
  const funding = await getFunding(quoteId);
  const fundingState = shortState(funding.state, 'PARTICIPANT_FUNDING_STATE_');
  if (fundingState !== 'READY') {
    const shortfall = toMoney(funding.shortfall);
    throw httpError(
      409,
      'INSUFFICIENT_FUNDS',
      shortfall
        ? `La bóveda necesita ${shortfall.amount} ${shortfall.currency} más para esta compra`
        : `La bóveda no está lista para pagar (${fundingState})`,
    );
  }
  const payment = await kwalRequest('POST', '/payments', {
    body: { paymentId: `pay_${randomUUID().replace(/-/g, '')}`, quoteId },
  });
  return normalizePayment(payment);
}

async function getCheckout(id) {
  return normalizePayment(await kwalRequest('GET', `/payments/${encodeURIComponent(id)}`));
}

async function getPaymentSetup() {
  const funding = await getFunding();
  const state = shortState(funding.state, 'PARTICIPANT_FUNDING_STATE_');
  const transfer = funding.instructions?.transferInstructions || funding.instructions || {};
  return {
    provider: name,
    ready: state === 'READY',
    methods: [],
    vault: {
      state,
      address: funding.vaultAddress,
      chain: funding.chain,
      chainId: funding.instructions?.chainId,
      available: toMoney(funding.available),
      explorerUrl: funding.vaultAddress ? `${config.kwal.explorerUrl}/address/${funding.vaultAddress}` : undefined,
      tokenAddress: transfer.tokenAddress,
      usdcFaucetUrl: funding.instructions?.usdcFaucetUrl,
      gasFaucetUrl: funding.instructions?.gasFaucetUrl,
    },
  };
}

async function startPaymentSetup() {
  throw httpError(
    409,
    'SETUP_WITH_SKILL',
    'La bóveda de Kwal se configura con el skill agent-payment en Claude Code (ver README)',
  );
}

module.exports = {
  name,
  approvalMode: 'vault',
  searchProducts,
  createQuote,
  getQuote,
  selectShipping,
  createCheckout,
  getCheckout,
  getPaymentSetup,
  startPaymentSetup,
};
