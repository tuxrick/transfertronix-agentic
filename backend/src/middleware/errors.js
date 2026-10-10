const { ReapError } = require('../reap/client');
const { KwalError } = require('../kwal/client');
const { languageOf, message } = require('../i18n');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ReapError) {
    console.error(`Reap ${err.status} ${err.code}: ${err.message}`);
    return res.status(err.status).json({ error: { code: err.code, message: err.message, detail: err.detail } });
  }
  if (err instanceof KwalError) {
    console.error(`Kwal ${err.status} ${err.code}: ${err.message}`);
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.status && err.code) {
    const text = message(languageOf(req), err.messageKey || err.code, err.params) || err.message;
    return res.status(err.status).json({ error: { code: err.code, message: text } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: message(languageOf(req), 'INTERNAL_ERROR') } });
}

/** `params` fill the localized message; `messageKey` overrides the catalog key when it differs from `code`. */
function httpError(status, code, fallback, params = {}, messageKey) {
  return Object.assign(new Error(fallback), { status, code, params, messageKey });
}

module.exports = { errorHandler, httpError };
