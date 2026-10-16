/**
 * ============================================================================
 * CLOUDCLASS - SUBMISSION & GRADING ROUTES
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const submissionController = require('../controllers/submissionController');
const { authenticateToken, requireAuth, requireRole } = require('../middleware/auth');
const { validateUploadSecurity } = require('../middleware/fileSecurity');
const { uploadLimiter, apiLimiter } = require('../middleware/rateLimiter');
const env = require('../config/env');

// In-memory multer storage for S3 streaming
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 }
});

router.use(authenticateToken);

// List submissions
router.get('/', apiLimiter, submissionController.getAll);

// Upload submission (with rate limiter and binary magic-byte security scanner)
router.post(
  '/',
  uploadLimiter,
  upload.single('file'),
  validateUploadSecurity,
  submissionController.submit
);

// Grade submission (Faculty only)
router.post(
  '/:id/grade',
  apiLimiter,
  requireAuth,
  requireRole('faculty', 'admin'),
  submissionController.grade
);

// Presigned download link
router.get('/download', apiLimiter, submissionController.download);

module.exports = router;
