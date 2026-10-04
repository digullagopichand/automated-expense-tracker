const logger = require('../utils/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled API Error', {
    requestId: req.id,
    url: req.originalUrl,
    method: req.method,
    error: err
  });

  const statusCode = err.statusCode || err.status || 500;
  const response = {
    error: {
      message: err.message || 'An unexpected internal server error occurred.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      requestId: req.id
    }
  };

  if (err.errors) {
    response.error.details = err.errors;
  }

  if (config.nodeEnv !== 'production' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
