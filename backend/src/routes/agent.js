const express = require('express');
const { askReapli } = require('../agent/reapli');
const { httpError } = require('../middleware/errors');

const router = express.Router();

// POST /api/agent/message  { message, history, context } -> { text, functionCall? }
router.post('/message', async (req, res) => {
  const { message, history, context } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    throw httpError(400, 'VALIDATION_ERROR', 'message is required');
  }
  if (message.length > 2000) {
    throw httpError(400, 'VALIDATION_ERROR', 'message is too long');
  }
  res.json(await askReapli({ message: message.trim(), history, context }));
});

module.exports = router;
