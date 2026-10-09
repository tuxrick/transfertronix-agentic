require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  reap: {
    apiKey: process.env.REAP_API_KEY || '',
    baseUrl: process.env.REAP_BASE_URL || 'https://mx.sandbox.api.reap.global',
    version: process.env.REAP_VERSION || '2025-02-14',
    simulateCheckout: process.env.REAP_SIMULATE_CHECKOUT === 'true',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  appDeepLink: process.env.APP_DEEP_LINK || 'transfertronix://agentic/return',
};

module.exports = { config };
