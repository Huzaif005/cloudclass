/**
 * ============================================================================
 * CLOUDCLASS - EXPRESS APPLICATION MODULE
 * ============================================================================
 * Production-hardened with Helmet security headers, CORS, Gzip compression,
 * Morgan request logging, API routing, and centralized error handling.
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/authRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// Trust proxy for AWS Elastic Load Balancer / NGINX / CloudFront
app.set('trust proxy', 1);

// HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Performance: Gzip Compression
app.use(compression());

// Cross-Origin Resource Sharing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static Local Uploads Fallback
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// API Route Registration
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);

// Static Web Frontend Assets (Served from workspace root)
const publicDir = path.join(__dirname, '..');
app.use(express.static(publicDir));

// SPA Fallback for client-side navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
