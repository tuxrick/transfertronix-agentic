/**
 * Prueba rápida contra Reap sandbox: búsqueda, catálogo y cotización.
 * Uso: node scripts/reap-smoke.js "teclado inalambrico" MX
 */
const agentic = require('../src/reap/agentic');
const { config } = require('../src/config');
const { listMerchants } = require('../src/catalog/merchants');

const query = process.argv[2] || 'keyboard';
const country = process.argv[3] || 'MX';

const demoAddress = {
  firstName: 'Demo',
  lastName: 'Transfertronix',
  phone: '+5215512345678',
  addressLine1: 'Av. Paseo de la Reforma 222',
  city: 'Ciudad de México',
  region: 'CDMX',
  postalCode: '06600',
  country: 'MX',
};

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${name}`);
    return result;
  } catch (error) {
    console.log(`❌ ${name}: ${error.status || ''} ${error.code || ''} ${error.message}`);
    return null;
  }
}

(async () => {
  console.log(`Reap ${config.reap.baseUrl} · versión ${config.reap.version} · key ${config.reap.apiKey ? 'configurada' : 'FALTA'}\n`);

  const search = await step(`Búsqueda "${query}" (${country})`, () =>
    agentic.searchProducts({ query, country, limit: 5 }),
  );
  search?.products.forEach(p =>
    console.log(`   · ${p.name} | ${p.merchant?.name} | ${p.previewVariant?.price?.amount} ${p.previewVariant?.price?.currency} | variant ${p.previewVariant?.id}`),
  );
  if (search?.warnings?.length) console.log('   warnings:', search.warnings);

  const variantId = search?.products.find(p => p.previewVariant?.id)?.previewVariant.id;
  if (variantId) {
    const quote = await step('Cotización por variante (búsqueda)', () =>
      agentic.createQuote({ items: [{ variantId, quantity: 1 }], email: 'demo@transfertronix.dev', shippingAddress: demoAddress }),
    );
    if (quote) console.log(`   · ${quote.id} total ${quote.amountBreakdown.finalAmount.amount} ${quote.amountBreakdown.finalAmount.currency}`);
  }

  const merchant = listMerchants({ country }).find(m => m.market === country) || listMerchants({ country })[0];
  const cartUrl = merchant.testProduct.cartUrl;
  const quote = await step(`Cotización por carrito del catálogo (${merchant.domain})`, () =>
    agentic.createQuote({
      externalCheckout: { merchantDomain: new URL(cartUrl).hostname, checkoutUrl: cartUrl },
      email: 'demo@transfertronix.dev',
      shippingAddress: demoAddress,
    }),
  );
  if (quote) {
    console.log(`   · ${quote.id} total ${quote.amountBreakdown.finalAmount.amount} ${quote.amountBreakdown.finalAmount.currency}`);
    quote.shippingOptions.forEach(o => console.log(`   · envío ${o.name} ${o.price.amount} ${o.price.currency}${o.selected ? ' (elegido)' : ''}`));
  }

  await step('Listar enrollments (owner de prueba)', () => agentic.listEnrollments({ ownerId: 'smoke-test' }));
})();
