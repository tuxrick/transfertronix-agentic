/**
 * Agentic routes used by the app. All of them require a Supabase session.
 */
const express = require('express');
const agentic = require('../reap/agentic');
const { config } = require('../config');
const { httpError } = require('../middleware/errors');

const router = express.Router();

function returnUrl(kind, ref) {
  const url = new URL('/agentic/return', config.publicBaseUrl);
  url.searchParams.set('kind', kind);
  if (ref) url.searchParams.set('ref', ref);
  return url.toString();
}

async function assertOwnEnrollment(enrollmentId, userId) {
  const enrollment = await agentic.getEnrollment(enrollmentId);
  if (enrollment.owner?.id !== userId) {
    throw httpError(403, 'FORBIDDEN', 'El método de pago no pertenece a este usuario');
  }
  return enrollment;
}

// Enrollments
router.get('/enrollments', async (req, res) => {
  res.json(await agentic.listEnrollments({ ownerId: req.user.id, cursor: req.query.cursor }));
});

router.post('/enrollments', async (req, res) => {
  const enrollment = await agentic.createEnrollment({
    owner: req.user,
    returnUrl: returnUrl('enrollment'),
  });
  res.status(201).json(enrollment);
});

router.get('/enrollments/:id', async (req, res) => {
  res.json(await assertOwnEnrollment(req.params.id, req.user.id));
});

// Product discovery
router.post('/products/search', async (req, res) => {
  const { query } = req.body || {};
  if (!query) throw httpError(400, 'VALIDATION_ERROR', 'query es requerido');
  res.json(await agentic.searchProducts(req.body));
});

router.post('/products/details', async (req, res) => {
  res.json(await agentic.getProductDetails(req.body?.productIds || []));
});

router.post('/products/variant', async (req, res) => {
  res.json(await agentic.resolveVariant(req.body || {}));
});

// Quotes
router.post('/quotes', async (req, res) => {
  const { items, shippingAddress, offerCode } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'items es requerido');
  }
  res.status(201).json(await agentic.createQuote({ items, shippingAddress, offerCode, email: req.user.email }));
});

router.get('/quotes/:id', async (req, res) => {
  res.json(await agentic.getQuote(req.params.id));
});

router.post('/quotes/:id/shipping-option', async (req, res) => {
  res.json(await agentic.selectShippingOption(req.params.id, req.body?.shippingOptionId));
});

// Checkouts: the spend cap is enforced against the live quote, not the client's number.
router.post('/checkouts', async (req, res) => {
  const { quoteId, enrollmentId, maxAmount, ref } = req.body || {};
  if (!quoteId || !enrollmentId) {
    throw httpError(400, 'VALIDATION_ERROR', 'quoteId y enrollmentId son requeridos');
  }

  const enrollment = await assertOwnEnrollment(enrollmentId, req.user.id);
  if (enrollment.status !== 'ACTIVE') {
    throw httpError(409, 'ENROLLMENT_NOT_ACTIVE', 'El método de pago aún no está activo');
  }

  const quote = await agentic.getQuote(quoteId);
  if (new Date(quote.expiresAt) <= new Date()) {
    throw httpError(409, 'QUOTE_EXPIRED', 'La cotización expiró, vuelve a cotizar');
  }
  const finalAmount = quote.amountBreakdown?.finalAmount?.amount;
  if (maxAmount !== undefined && finalAmount > Number(maxAmount)) {
    throw httpError(422, 'BUDGET_EXCEEDED', `El total (${finalAmount}) excede el tope autorizado (${maxAmount})`);
  }

  const checkout = await agentic.createCheckout({ quoteId, enrollmentId, returnUrl: returnUrl('checkout', ref) });
  res.status(201).json(checkout);
});

router.get('/checkouts/:id', async (req, res) => {
  res.json(await agentic.getCheckout(req.params.id));
});

module.exports = router;
