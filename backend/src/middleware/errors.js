const { ReapError } = require('../reap/client');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ReapError) {
    console.error(`Reap ${err.status} ${err.code}: ${err.message}`);
    return res.status(err.status).json({ error: { code: err.code, message: err.message, detail: err.detail } });
  }
  if (err.status && err.code) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
}

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

module.exports = { errorHandler, httpError };
