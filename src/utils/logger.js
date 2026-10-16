/**
 * ============================================================================
 * CLOUDCLASS - STRUCTURED LOGGER UTILITY
 * ============================================================================
 */

const isProd = process.env.NODE_ENV === 'production';

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  if (isProd) {
    return JSON.stringify({ timestamp, level, message, ...meta });
  }
  const prefix = `[${timestamp}] [${level}]`;
  if (meta && Object.keys(meta).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(meta)}`;
  }
  return `${prefix} ${message}`;
}

const logger = {
  info: (msg, meta) => console.log(formatMessage('INFO', msg, meta)),
  warn: (msg, meta) => console.warn(formatMessage('WARN', msg, meta)),
  error: (msg, meta) => console.error(formatMessage('ERROR', msg, meta)),
  debug: (msg, meta) => {
    if (!isProd || process.env.LOG_LEVEL === 'debug') {
      console.log(formatMessage('DEBUG', msg, meta));
    }
  }
};

module.exports = logger;
