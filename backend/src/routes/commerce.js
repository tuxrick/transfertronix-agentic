/**
 * Provider-agnostic commerce routes used by the app (Reap or Kwal).
 * All of them require a Supabase session.
 */
const express = require('express');
const { getProvider } = require('../providers');
const { config } = require('../config');
const { httpError } = require('../middleware/errors');
const { listMerchants, listCategories, findCatalogProducts } = require('../catalog/merchants');

const router = express.Router();

function returnUrl(kind, ref) {
  const url = new URL('/agentic/return', config.publicBaseUrl);
  url.searchParams.set('kind', kind);
  if (ref) url.searchParams.set('ref', ref);
  return url.toString();
}

function assertSupportedCheckoutUrl(externalCheckout) {
  const host = new URL(externalCheckout.checkoutUrl).hostname;
  const supported = listMerchants().some(m => new URL(m.testProduct.cartUrl).hostname === host);
  if (!supported || host !== externalCheckout.merchantDomain) {
    throw httpError(422, 'MERCHANT_NOT_SUPPORTED', 'Solo se puede comprar en comercios de la lista soportada');
  }
}

router.get('/provider', (req, res) => {
  const provider = getProvider();
  res.json({ name: provider.name, approvalMode: provider.approvalMode });
});

// Supported merchants
router.get('/merchants', (req, res) => {
  const { country, category } = req.query;
  res.json({ items: listMerchants({ country, category }), categories: listCategories(country) });
});

// Payment setup: Reap card enrollments or Kwal vault
router.get('/payment-setup', async (req, res) => {
  res.json(await getProvider().getPaymentSetup(req.user));
});

router.post('/payment-setup', async (req, res) => {
  res.status(201).json(await getProvider().startPaymentSetup({ user: req.user, returnUrl: returnUrl('enrollment') }));
});

// Product discovery: provider search first, supported-merchant catalog as fallback
router.post('/products/search', async (req, res) => {
  const { query, country, currency, maxPrice, merchantName, limit = 5 } = req.body || {};
  if (!query) throw httpError(400, 'VALIDATION_ERROR', 'query es requerido');

  const result = await getProvider()
    .searchProducts({ query, country, currency, maxPrice, merchantName, limit })
    .catch(error => {
      console.warn(`Búsqueda del proveedor falló (${error.code}), usando catálogo`);
      return { products: [], warnings: [error.message] };
    });

  if (result.products.length === 0 && getProvider().name === 'reap') {
    result.products = findCatalogProducts({ query, country, limit });
  }
  res.json(result);
});

// Quotes
router.post('/quotes', async (req, res) => {
  const { productId, variantId, quantity, externalCheckout, shippingAddress } = req.body || {};
  if (!variantId && !productId && !externalCheckout) {
    throw httpError(400, 'VALIDATION_ERROR', 'variantId, productId o externalCheckout es requerido');
  }
  if (externalCheckout) assertSupportedCheckoutUrl(externalCheckout);

  const quote = await getProvider().createQuote({
    productId,
    variantId,
    quantity,
    externalCheckout,
    shippingAddress,
    email: req.user.email,
  });
  res.status(201).json(quote);
});

router.get('/quotes/:id', async (req, res) => {
  res.json(await getProvider().getQuote(req.params.id));
});

router.post('/quotes/:id/shipping-option', async (req, res) => {
  res.json(await getProvider().selectShipping(req.params.id, req.body?.shippingOptionId));
});

// Checkouts: the spend cap is enforced against the live quote, not the client's number.
router.post('/checkouts', async (req, res) => {
  const { quoteId, maxAmount, maxCurrency, ref } = req.body || {};
  if (!quoteId) throw httpError(400, 'VALIDATION_ERROR', 'quoteId es requerido');

  const provider = getProvider();
  const quote = await provider.getQuote(quoteId);
  if (quote.expiresAt && new Date(quote.expiresAt) <= new Date()) {
    throw httpError(409, 'QUOTE_EXPIRED', 'La cotización expiró, vuelve a cotizar');
  }
  if (maxAmount !== undefined && maxAmount !== null) {
    // Without FX rates a cap in another currency cannot be verified, so it blocks the charge.
    if (maxCurrency && quote.total?.currency !== maxCurrency) {
      throw httpError(
        422,
        'BUDGET_CURRENCY_MISMATCH',
        `El tope está en ${maxCurrency} y la cotización en ${quote.total?.currency}; define el tope en ${quote.total?.currency}`,
      );
    }
    if (quote.total?.amount > Number(maxAmount)) {
      throw httpError(
        422,
        'BUDGET_EXCEEDED',
        `El total (${quote.total.amount} ${quote.total.currency}) excede el tope autorizado (${maxAmount} ${maxCurrency || ''})`.trim(),
      );
    }
  }

  const checkout = await provider.createCheckout({ quoteId, user: req.user, returnUrl: returnUrl('checkout', ref) });
  res.status(201).json(checkout);
});

router.get('/checkouts/:id', async (req, res) => {
  res.json(await getProvider().getCheckout(req.params.id));
});

module.exports = router;
