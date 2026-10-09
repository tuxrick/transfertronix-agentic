/**
 * Low-level HTTP client for the Reap API.
 * The API key never leaves the backend.
 */
const { randomUUID } = require('node:crypto');
const { config } = require('../config');

class ReapError extends Error {
  constructor(status, body) {
    const code = body?.error?.code || 'REAP_ERROR';
    super(body?.error?.message || `Reap respondió ${status}`);
    this.name = 'ReapError';
    this.status = status;
    this.code = code;
    this.detail = body?.error?.detail ?? null;
  }
}

async function reapRequest(method, path, { body, query, idempotent = false, headers = {} } = {}) {
  if (!config.reap.apiKey) {
    throw new ReapError(500, { error: { code: 'REAP_NOT_CONFIGURED', message: 'REAP_API_KEY no está configurada' } });
  }

  const url = new URL(path, config.reap.baseUrl);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const requestHeaders = {
    Authorization: `Bearer ${config.reap.apiKey}`,
    'Reap-Version': config.reap.version,
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (idempotent) requestHeaders['Idempotency-Key'] = headers['Idempotency-Key'] || randomUUID();

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) throw new ReapError(response.status, data);
  return data;
}

module.exports = { reapRequest, ReapError };
