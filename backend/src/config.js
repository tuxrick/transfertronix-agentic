require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  // reap | kwal
  paymentProvider: (process.env.PAYMENT_PROVIDER || 'reap').toLowerCase(),
  // Simulates quotes/checkouts only when the Reap sandbox cannot quote
  demoFallback: process.env.DEMO_FALLBACK === 'true',
  reap: {
    apiKey: process.env.REAP_API_KEY || '',
    baseUrl: process.env.REAP_BASE_URL || 'https://mx.sandbox.api.reap.global',
    version: process.env.REAP_VERSION || '2025-02-14',
    simulateCheckout: process.env.REAP_SIMULATE_CHECKOUT === 'true',
  },
  kwal: {
    serviceUrl: process.env.KWAL_SERVICE_URL || 'https://api.sandbox.services.payward.com',
    // Path to the credentials.json written by the Kwal skill (outside the repo)
    credentialsFile: process.env.KWAL_CREDENTIALS_FILE || '',
    token: process.env.KWAL_TOKEN || '',
    explorerUrl: process.env.KWAL_EXPLORER_URL || 'https://explorer-sepolia.inkonchain.com',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  appDeepLink: process.env.APP_DEEP_LINK || 'transfertronix://agentic/return',
};

module.exports = { config };
