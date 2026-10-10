/**
 * Supported merchant list shared by the hackathon organizers.
 * Only these merchants can be used in the sandbox.
 */
const merchants = require('../data/merchants.json');

function shipsTo(merchant, country) {
  if (!country) return true;
  const code = country.toUpperCase() === 'UK' ? 'GB' : country.toUpperCase();
  return merchant.shipsTo.includes('*') || merchant.shipsTo.includes(code);
}

function listMerchants({ country, category } = {}) {
  return merchants.filter(m => shipsTo(m, country) && (!category || m.category === category));
}

function listCategories(country) {
  const counts = {};
  listMerchants({ country }).forEach(m => {
    counts[m.category] = (counts[m.category] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, merchantCount]) => ({ name, merchantCount }));
}

/**
 * Keyword match over test products, used as a deterministic fallback
 * when the provider's product search returns nothing.
 */
function findCatalogProducts({ query, country, limit = 3 }) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = listMerchants({ country })
    .map(m => {
      const haystack = `${m.testProduct.name} ${m.category} ${m.domain}`.toLowerCase();
      return { merchant: m, score: words.filter(w => haystack.includes(w)).length };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ merchant }) => toProduct(merchant));
}

function toProduct(merchant) {
  const { testProduct } = merchant;
  const cartUrl = `${testProduct.cartUrl}`;
  return {
    id: `catalog:${merchant.domain}:${testProduct.variantId}`,
    name: testProduct.name,
    merchant: merchant.domain,
    price: { amount: testProduct.price, currency: testProduct.currency },
    source: 'catalog',
    externalCheckout: {
      merchantDomain: new URL(cartUrl).hostname,
      checkoutUrl: cartUrl,
    },
  };
}

module.exports = { listMerchants, listCategories, findCatalogProducts, shipsTo };
