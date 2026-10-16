/**
 * ============================================================================
 * CLOUDCLASS - CENTRALIZED PRODUCTION ERROR HANDLER
 * ============================================================================
 */

const env = require('../config/env');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.originalUrl} - Error ${statusCode}: ${message}`, {
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
    body: req.body,
    ip: req.ip
  });

  const response = {
    error: message,
    status: statusCode
  };

  if (env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
