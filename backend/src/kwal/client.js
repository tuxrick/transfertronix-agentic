/**
 * HTTP client for the Kwal participant API (Payward).
 * The participant is registered with the Kwal agent skill; this backend only
 * reuses its session token, which never reaches the app.
 * Skill: https://github.com/payward/kwal-skill
 */
const fs = require('node:fs');
const { config } = require('../config');

class KwalError extends Error {
  constructor(status, body, path) {
    const code = body?.code || body?.error?.code || 'KWAL_ERROR';
    super(body?.message || body?.error?.message || `Kwal respondió ${status} en ${path}`);
    this.name = 'KwalError';
    this.status = status >= 500 ? 502 : status;
    this.code = code;
  }
}

function loadToken() {
  if (config.kwal.token) return config.kwal.token;
  if (!config.kwal.credentialsFile) return '';
  const credentials = JSON.parse(fs.readFileSync(config.kwal.credentialsFile, 'utf8'));
  if (credentials.expiresAtUnixSeconds && credentials.expiresAtUnixSeconds * 1000 < Date.now()) {
    throw new KwalError(401, { code: 'KWAL_SESSION_EXPIRED', message: 'La sesión de Kwal expiró (dura 7 días)' }, 'credentials');
  }
  return credentials.token || '';
}

async function kwalRequest(method, path, { body, query } = {}) {
  const token = loadToken();
  if (!token) {
    throw new KwalError(500, { code: 'KWAL_NOT_CONFIGURED', message: 'Configura KWAL_CREDENTIALS_FILE o KWAL_TOKEN' }, path);
  }

  const url = new URL(`/kwal/participant/v1${path}`, config.kwal.serviceUrl);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new KwalError(response.status, data, path);
  return data;
}

module.exports = { kwalRequest, KwalError };
