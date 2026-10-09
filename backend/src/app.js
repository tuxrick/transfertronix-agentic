const express = require('express');
const cors = require('cors');
const agenticRoutes = require('./routes/agentic');
const returnRoutes = require('./routes/return');
const { requireUser } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/agentic/return', returnRoutes);
  app.use('/api/agentic', requireUser, agenticRoutes);

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
