const { createApp } = require('./src/app');
const { config } = require('./src/config');

const app = createApp();

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Transfertronix backend escuchando en http://localhost:${config.port}`);
    console.log(`Reap: ${config.reap.baseUrl} (version ${config.reap.version})`);
  });
}

module.exports = app;
