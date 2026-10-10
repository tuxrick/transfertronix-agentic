/**
 * Demo fallback for when the Reap sandbox cannot quote (QUOTE_TEMPORARILY_UNAVAILABLE).
 * Quotes and checkouts are simulated and flagged with `demo: true`; everything
 * else (search, card enrollment, spend caps) still runs against Reap.
 * State travels inside the id because serverless functions keep no memory.
 */
const { randomUUID } = require('node:crypto');
const { config } = require('../config');

const QUOTE_PREFIX = 'demo_qt_';
const CHECKOUT_PREFIX = 'demo_chk_';
const QUOTE_TTL_MS = 15 * 60 * 1000;

function encode(prefix, data) {
  return prefix + Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decode(prefix, id) {
  return JSON.parse(Buffer.from(id.slice(prefix.length), 'base64url').toString('utf8'));
}

const isEnabled = () => config.demoFallback;
const isDemoQuote = id => typeof id === 'string' && id.startsWith(QUOTE_PREFIX);
const isDemoCheckout = id => typeof id === 'string' && id.startsWith(CHECKOUT_PREFIX);

function createQuote({ price, quantity = 1 }) {
  if (!price?.amount || !price?.currency) return null;
  const total = { amount: Math.round(price.amount * quantity * 100) / 100, currency: price.currency };
  return getQuote(encode(QUOTE_PREFIX, { total, expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString() }));
}

function getQuote(id) {
  const { total, expiresAt } = decode(QUOTE_PREFIX, id);
  return {
    id,
    demo: true,
    subtotal: total,
    discounts: [],
    total,
    expiresAt,
    shippingOptions: [],
  };
}

function createCheckout(quoteId) {
  const { total } = decode(QUOTE_PREFIX, quoteId);
  const orderId = `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`;
  return getCheckout(encode(CHECKOUT_PREFIX, { total, orderId }));
}

function getCheckout(id) {
  const { total, orderId } = decode(CHECKOUT_PREFIX, id);
  return { id, demo: true, status: 'COMPLETED', orderId, total };
}

module.exports = { isEnabled, isDemoQuote, isDemoCheckout, createQuote, getQuote, createCheckout, getCheckout };
