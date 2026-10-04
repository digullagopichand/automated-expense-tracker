const config = require('../config');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = config.nodeEnv === 'production' ? 'info' : 'debug';

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...meta
  };

  if (meta.error instanceof Error) {
    logEntry.error = {
      message: meta.error.message,
      stack: meta.error.stack,
      name: meta.error.name
    };
  }

  return JSON.stringify(logEntry);
}

const logger = {
  error: (msg, meta) => {
    if (levels[currentLevel] >= levels.error) {
      console.error(formatMessage('error', msg, meta));
    }
  },
  warn: (msg, meta) => {
    if (levels[currentLevel] >= levels.warn) {
      console.warn(formatMessage('warn', msg, meta));
    }
  },
  info: (msg, meta) => {
    if (levels[currentLevel] >= levels.info) {
      console.log(formatMessage('info', msg, meta));
    }
  },
  debug: (msg, meta) => {
    if (levels[currentLevel] >= levels.debug) {
      console.log(formatMessage('debug', msg, meta));
    }
  }
};

module.exports = logger;
