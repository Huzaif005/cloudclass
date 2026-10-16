/**
 * ============================================================================
 * CLOUDCLASS - AWS S3 CLIENT CONFIGURATION
 * ============================================================================
 */

const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');
const logger = require('../utils/logger');

let s3Client = null;
let isConfigured = false;

// Check if credentials exist explicitly or via IAM Role / Instance Profile
const hasExplicitCreds = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
const hasBucket = Boolean(env.AWS_S3_BUCKET);

if (hasBucket) {
  const clientConfig = {
    region: env.AWS_REGION,
    maxAttempts: 3
  };

  if (hasExplicitCreds) {
    clientConfig.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    };
  }
  // Otherwise SDK automatically looks for IAM Instance Profile / ECS Task Role / Environment variables

  try {
    s3Client = new S3Client(clientConfig);
    isConfigured = true;
    logger.info(`AWS S3 Client initialized for bucket: ${env.AWS_S3_BUCKET} (${env.AWS_REGION})`);
  } catch (err) {
    logger.error('Failed to initialize AWS S3 Client:', { error: err.message });
  }
} else {
  logger.info('AWS S3 Bucket name not defined in environment. Using local storage fallback.');
}

module.exports = {
  s3Client,
  isConfigured,
  bucketName: env.AWS_S3_BUCKET,
  region: env.AWS_REGION
};
