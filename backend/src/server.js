const app = require('./app');
const config = require('./config');
const db = require('./db/database');
const { runMigrations } = require('./db/migrate');
const logger = require('./utils/logger');

let server;

async function startServer() {
  try {
    logger.info('Initializing SQLite database engine...');
    await db.init();
    await runMigrations();

    server = app.listen(config.port, () => {
      logger.info(`Automated Expense Tracker API running on port ${config.port} [${config.nodeEnv}]`);
      logger.info(`Health check available at http://localhost:${config.port}/health`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      if (server) {
        server.close(() => {
          logger.info('HTTP server closed.');
          try {
            db.flush();
            logger.info('Database flushed successfully.');
          } catch (e) {
            logger.error('Error during database flush', { error: e });
          }
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
