/**
 * Reap Agentic Payments adapter.
 * The user stores a card once (enrollment) and approves each charge on a Reap page.
 */
const agentic = require('../reap/agentic');
const { httpError } = require('../middleware/errors');

const name = 'reap';

function normalizeQuote(quote) {
  const b = quote.amountBreakdown || {};
  return {
    id: quote.id,
    subtotal: b.itemsSubtotal,
    shipping: b.shipping,
    tax: b.tax && !b.tax.includedInPrices ? b.tax.amount : undefined,
    discounts: b.discounts || [],
    total: b.finalAmount,
    expiresAt: quote.expiresAt,
    shippingOptions: (quote.shippingOptions || []).map(o => ({
      id: o.id,
      name: o.name,
      price: o.price,
      selected: o.selected,
    })),
  };
}

function normalizeCheckout(checkout) {
  return {
    id: checkout.id,
    status: checkout.status,
    approvalUrl: checkout.nextAction?.url,
    approvalExpiresAt: checkout.nextAction?.expiresAt,
    orderId: checkout.orderId,
    total: checkout.finalAmount || checkout.amount,
  };
}

async function findActiveEnrollment(userId) {
  const { items = [] } = await agentic.listEnrollments({ ownerId: userId });
  return items.find(e => e.status === 'ACTIVE');
}

async function searchProducts({ query, country, currency, maxPrice, merchantName, limit }) {
  const result = await agentic.searchProducts({ query, country, currency, maxPrice, merchantName, limit });
  return {
    products: result.products.map(p => ({
      id: p.id,
      name: p.name,
      merchant: p.merchant?.name,
      imageUrl: p.imageUrl,
      price: p.previewVariant?.price || p.priceRange?.min,
      variantId: p.previewVariant?.id,
      source: 'search',
    })),
    warnings: result.warnings || [],
  };
}

async function createQuote({ variantId, quantity = 1, externalCheckout, email, shippingAddress }) {
  const quote = await agentic.createQuote({
    items: externalCheckout ? undefined : [{ variantId, quantity }],
    externalCheckout,
    email,
    shippingAddress,
  });
  return normalizeQuote(quote);
}

async function getQuote(id) {
  return normalizeQuote(await agentic.getQuote(id));
}

async function selectShipping(quoteId, shippingOptionId) {
  return normalizeQuote(await agentic.selectShippingOption(quoteId, shippingOptionId));
}

async function createCheckout({ quoteId, user, returnUrl }) {
  const enrollment = await findActiveEnrollment(user.id);
  if (!enrollment) {
    throw httpError(409, 'NO_PAYMENT_METHOD', 'Agrega una tarjeta en Métodos de pago antes de comprar');
  }
  return normalizeCheckout(await agentic.createCheckout({ quoteId, enrollmentId: enrollment.id, returnUrl }));
}

async function getCheckout(id) {
  return normalizeCheckout(await agentic.getCheckout(id));
}

async function getPaymentSetup(user) {
  const { items = [] } = await agentic.listEnrollments({ ownerId: user.id });
  return {
    provider: name,
    ready: items.some(e => e.status === 'ACTIVE'),
    methods: items.map(e => ({
      id: e.id,
      status: e.status,
      label: e.paymentMethod ? `${e.paymentMethod.network} •••• ${e.paymentMethod.last4}` : 'Tarjeta en registro',
      actionUrl: e.status === 'REQUIRES_ACTION' ? e.nextAction?.url : undefined,
    })),
  };
}

async function startPaymentSetup({ user, returnUrl }) {
  const enrollment = await agentic.createEnrollment({ owner: user, returnUrl });
  return { actionUrl: enrollment.nextAction?.url, id: enrollment.id };
}

module.exports = {
  name,
  approvalMode: 'hosted_page',
  searchProducts,
  createQuote,
  getQuote,
  selectShipping,
  createCheckout,
  getCheckout,
  getPaymentSetup,
  startPaymentSetup,
};
