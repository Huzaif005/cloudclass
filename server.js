/**
 * ============================================================================
 * CLOUDCLASS - AWS ENTERPRISE BACKEND SERVER ENTRYPOINT
 * ============================================================================
 * Production server with graceful shutdown handling (SIGTERM, SIGINT)
 * for AWS Elastic Beanstalk, AWS App Runner, AWS ECS, and PM2 Cluster Mode.
 * ============================================================================
 */

const http = require('http');
const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { s3Client, isConfigured, bucketName } = require('./src/config/aws-s3');

const server = http.createServer(app);

// Start HTTP Server
server.listen(env.PORT, () => {
  logger.info(`================================================================`);
  logger.info(`✦ CloudClass Enterprise Backend running on port: ${env.PORT}`);
  logger.info(`✦ Environment: ${env.NODE_ENV}`);
  logger.info(`✦ Process ID: ${process.pid}`);
  logger.info(`✦ Storage Provider: ${isConfigured ? `AWS S3 (s3://${bucketName})` : 'Local Disk Fallback'}`);
  logger.info(`✦ Region: ${env.AWS_REGION}`);
  logger.info(`✦ Health Endpoint: http://localhost:${env.PORT}/api/health`);
  logger.info(`================================================================`);
});

// ============================================================================
// GRACEFUL SHUTDOWN (AWS ECS / Elastic Beanstalk / Kubernetes / PM2)
// ============================================================================
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed. In-flight requests drained.');
    // Close any database connection pools or socket connections here
    process.exit(0);
  });

  // Force shutdown if connections do not drain within 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing termination.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Uncaught Exception & Rejection Handlers
process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception:', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason });
});

module.exports = server;
