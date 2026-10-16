/**
 * ============================================================================
 * CLOUDCLASS - AWS S3 STORAGE SERVICE
 * ============================================================================
 * Handles S3 object uploads, presigned URLs for secure downloads, and
 * fallback to local uploads directory when running without AWS keys.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, isConfigured, bucketName } = require('../config/aws-s3');
const logger = require('../utils/logger');

// Local upload fallback directory
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

const s3Service = {
  /**
   * Check if AWS S3 bucket is active and reachable
   */
  async checkConnection() {
    if (!isConfigured || !s3Client) {
      return { status: 'fallback', provider: 'Local Disk Storage', bucket: 'local' };
    }
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return { status: 'connected', provider: 'AWS S3', bucket: bucketName };
    } catch (err) {
      logger.warn('AWS S3 HeadBucket check warning:', { error: err.message });
      return { status: 'unreachable', provider: 'AWS S3', bucket: bucketName, error: err.message };
    }
  },

  /**
   * Upload file to AWS S3 or fallback to local disk
   */
  async uploadFile({ buffer, key, contentType, metadata = {} }) {
    // 1. If AWS S3 is active
    if (isConfigured && s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream',
          Metadata: metadata
        });

        await s3Client.send(command);
        logger.info(`Uploaded file to AWS S3: s3://${bucketName}/${key}`);

        return {
          storageType: 's3',
          s3Key: key,
          bucket: bucketName,
          downloadUrl: `/api/submissions/download?key=${encodeURIComponent(key)}`
        };
      } catch (err) {
        logger.error('Failed uploading to AWS S3, falling back to local disk:', { error: err.message });
      }
    }

    // 2. Local disk fallback
    const safeBaseName = path.basename(key);
    const localFilePath = path.join(LOCAL_UPLOAD_DIR, safeBaseName);
    fs.writeFileSync(localFilePath, buffer);
    logger.info(`Saved file to local storage: ${localFilePath}`);

    return {
      storageType: 'local',
      s3Key: key,
      localPath: localFilePath,
      downloadUrl: `/uploads/${safeBaseName}`
    };
  },

  /**
   * Generate secure presigned URL for downloading S3 file
   */
  async getDownloadUrl(key, expiresInSeconds = 3600) {
    if (isConfigured && s3Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key
        });
        return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
      } catch (err) {
        logger.error('Failed generating presigned URL:', { error: err.message });
      }
    }

    // Local fallback
    const safeBaseName = path.basename(key);
    const localPath = path.join(LOCAL_UPLOAD_DIR, safeBaseName);
    if (fs.existsSync(localPath)) {
      return `/uploads/${safeBaseName}`;
    }

    return null;
  },

  /**
   * Delete an object from storage
   */
  async deleteFile(key) {
    if (isConfigured && s3Client) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key
        }));
        logger.info(`Deleted file from AWS S3: ${key}`);
      } catch (err) {
        logger.error('Error deleting S3 file:', { error: err.message });
      }
    }

    // Remove local file if present
    const localPath = path.join(LOCAL_UPLOAD_DIR, path.basename(key));
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (_) {}
    }
  }
};

module.exports = s3Service;
