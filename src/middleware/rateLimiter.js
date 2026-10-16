/**
 * ============================================================================
 * CLOUDCLASS - RATE LIMITING MIDDLEWARE
 * ============================================================================
 * Prevents brute-force credential stuffing and API abuse on AWS deployments.
 * ============================================================================
 */

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// General API request limiter
const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_API,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP address. Please slow down.'
  }
});

// Upload endpoint limiter to prevent S3 flooding
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,                  // 30 files per 10 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload rate limit reached. Please wait a few minutes before submitting again.'
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  uploadLimiter
};
