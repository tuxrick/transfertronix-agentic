const reap = require('./reap');
const kwal = require('./kwal');
const { config } = require('../config');

const providers = { reap, kwal };

function getProvider() {
  const provider = providers[config.paymentProvider];
  if (!provider) {
    throw new Error(`PAYMENT_PROVIDER inválido: ${config.paymentProvider} (usa reap o kwal)`);
  }
  return provider;
}

module.exports = { getProvider };
