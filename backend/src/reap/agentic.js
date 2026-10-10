/**
 * Reap Agentic Payments: enrollments, product search, quotes and checkouts.
 * Docs: https://docs.reap.global/agentic-payments/overview
 */
const { reapRequest } = require('./client');
const { config } = require('../config');

// --- Enrollments (stored card, used as the payment handle) ---

function createEnrollment({ owner, returnUrl, idempotencyKey }) {
  return reapRequest('POST', '/agentic/enrollments', {
    idempotent: true,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    body: {
      source: 'EXTERNAL',
      owner: { type: 'CLIENT_REFERENCE', id: owner.id, email: owner.email },
      presentation: { type: 'REDIRECT', returnUrl },
    },
  });
}

function getEnrollment(id) {
  return reapRequest('GET', `/agentic/enrollments/${encodeURIComponent(id)}`);
}

function listEnrollments({ ownerId, limit = 20, cursor }) {
  return reapRequest('GET', '/agentic/enrollments', {
    query: { ownerType: 'CLIENT_REFERENCE', ownerId, limit, cursor },
  });
}

// --- Product discovery ---

function searchProducts({ query, country, currency, maxPrice, minPrice, merchantName, limit = 10 }) {
  const body = {
    query,
    context: { country, currency },
    filters: { availability: 'AVAILABLE_ONLY' },
    pagination: { limit },
  };
  if (minPrice !== undefined || maxPrice !== undefined) {
    body.filters.price = {
      ...(minPrice !== undefined && { min: String(minPrice) }),
      ...(maxPrice !== undefined && { max: String(maxPrice) }),
    };
  }
  if (merchantName) body.merchantPreference = { mode: 'PREFER', merchantName };
  return reapRequest('POST', '/agentic/products/search', { body });
}

function getProductDetails(productIds) {
  return reapRequest('POST', '/agentic/products/details', { body: { productIds } });
}

function resolveVariant({ productId, optionIds }) {
  return reapRequest('POST', '/agentic/products/variant', { body: { productId, optionIds } });
}

// --- Quotes ---

/**
 * Either `items` (discovery flow) or `externalCheckout` (merchant cart URL from the
 * supported merchant list). Reap requires a shipping address for the latter.
 */
function createQuote({ items, externalCheckout, email, shippingAddress, offerCode }) {
  return reapRequest('POST', '/agentic/quotes', {
    idempotent: true,
    body: {
      ...(externalCheckout ? { externalCheckout } : { items }),
      email,
      ...(shippingAddress && { shippingAddress }),
      ...(offerCode && { offerCode }),
    },
  });
}

function getQuote(id) {
  return reapRequest('GET', `/agentic/quotes/${encodeURIComponent(id)}`);
}

function selectShippingOption(quoteId, shippingOptionId) {
  return reapRequest('POST', `/agentic/quotes/${encodeURIComponent(quoteId)}/shipping-option`, {
    body: { shippingOptionId },
  });
}

// --- Checkouts ---

function createCheckout({ quoteId, enrollmentId, returnUrl }) {
  const headers = config.reap.simulateCheckout ? { 'X-Simulate-Checkout': 'COMPLETED' } : {};
  return reapRequest('POST', '/agentic/checkouts', {
    idempotent: true,
    headers,
    body: {
      quoteId,
      enrollmentId,
      presentation: { type: 'REDIRECT', returnUrl },
    },
  });
}

function getCheckout(id) {
  return reapRequest('GET', `/agentic/checkouts/${encodeURIComponent(id)}`);
}

module.exports = {
  createEnrollment,
  getEnrollment,
  listEnrollments,
  searchProducts,
  getProductDetails,
  resolveVariant,
  createQuote,
  getQuote,
  selectShippingOption,
  createCheckout,
  getCheckout,
};
