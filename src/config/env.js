/**
 * ============================================================================
 * CLOUDCLASS - ENVIRONMENT CONFIGURATION & VALIDATION
 * ============================================================================
 */

require('dotenv').config();
const logger = require('../utils/logger');

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 8000,
  JWT_SECRET: process.env.JWT_SECRET || 'cloudclass-aws-dev-secret-change-in-prod-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // AWS S3 Configuration
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  
  // Upload limits
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 25,
  ALLOWED_EXTENSIONS: (process.env.ALLOWED_EXTENSIONS || 'pdf,docx,doc,zip').split(',').map(e => e.trim().toLowerCase()),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 mins
  RATE_LIMIT_MAX_AUTH: parseInt(process.env.RATE_LIMIT_MAX_AUTH, 10) || 10,               // 10 login attempts per window
  RATE_LIMIT_MAX_API: parseInt(process.env.RATE_LIMIT_MAX_API, 10) || 300                 // 300 API requests per window
};

// Security sanity check for production
if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'cloudclass-aws-dev-secret-change-in-prod-2026') {
  logger.warn('SECURITY ALERT: Using default JWT_SECRET in production mode! Set JWT_SECRET in your AWS environment variables.');
}

module.exports = env;
