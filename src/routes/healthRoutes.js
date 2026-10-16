/**
 * ============================================================================
 * CLOUDCLASS - HEALTH & CLOUD CONFIGURATION ROUTES
 * ============================================================================
 * Supports AWS Application Load Balancer (ALB), ECS Health Checks,
 * and Elastic Beanstalk monitoring.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const s3Service = require('../services/s3Service');
const env = require('../config/env');

// Standard Health Check
router.get('/health', async (req, res) => {
  const s3Status = await s3Service.checkConnection();
  res.json({
    status: 'healthy',
    cloud: 'AWS',
    service: 'CloudClass Enterprise Backend',
    version: '2.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    region: env.AWS_REGION,
    storage: s3Status
  });
});

// Liveness probe (Returns 200 if Node process is alive)
router.get('/health/live', (req, res) => {
  res.status(200).send('OK');
});

// Readiness probe (Returns 200 if application is ready to accept traffic)
router.get('/health/ready', async (req, res) => {
  res.status(200).json({ ready: true });
});

// Cloud configuration info
router.get('/config', (req, res) => {
  res.json({
    cloudReady: true,
    provider: 'AWS',
    region: env.AWS_REGION,
    s3Bucket: env.AWS_S3_BUCKET || 'local-storage',
    maxFileSizeMB: env.MAX_FILE_SIZE_MB,
    allowedExtensions: env.ALLOWED_EXTENSIONS
  });
});

module.exports = router;
