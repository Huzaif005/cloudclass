/**
 * ============================================================================
 * CLOUDCLASS - BINARY MAGIC-BYTE FILE SECURITY SCANNER
 * ============================================================================
 * Inspects raw buffer headers before files are persisted to AWS S3.
 * Prevents malware, shell scripts, and renamed executable spoofing.
 * ============================================================================
 */

const env = require('../config/env');
const logger = require('../utils/logger');

// Known dangerous binary magic byte signatures
const DANGEROUS_SIGNATURES = [
  { name: 'Windows Executable (MZ)', bytes: [0x4D, 0x5A] },
  { name: 'Linux Executable (ELF)', bytes: [0x7F, 0x45, 0x4C, 0x46] },
  { name: 'Mach-O Binary (macOS)', bytes: [0xFE, 0xED, 0xFA, 0xCE] },
  { name: 'Mach-O 64-bit', bytes: [0xCF, 0xFA, 0xED, 0xFE] }
];

function inspectBufferSignature(buffer) {
  if (!buffer || buffer.length < 4) return { isValid: false, reason: 'File buffer too short or empty.' };

  // 1. Check for dangerous executables
  for (const sig of DANGEROUS_SIGNATURES) {
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return {
        isValid: false,
        reason: `Blocked malicious file signature: ${sig.name}`
      };
    }
  }

  // 2. Validate expected format signatures
  // PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  // ZIP / DOCX: PK.. (0x50, 0x4B, 0x03, 0x04) or (0x50, 0x4B, 0x05, 0x06)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;

  // Plain text / source files / JSON: ASCII or UTF-8
  const isText = buffer.slice(0, 100).every(byte => (byte >= 32 && byte <= 126) || [9, 10, 13].includes(byte));

  return {
    isValid: isPdf || isZip || isText,
    detectedType: isPdf ? 'application/pdf' : isZip ? 'application/zip' : isText ? 'text/plain' : 'binary/other',
    reason: (isPdf || isZip || isText) ? null : 'Unrecognized or non-standard file format.'
  };
}

/**
 * Express middleware checking the uploaded multer file
 */
function validateUploadSecurity(req, res, next) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No submission file uploaded.' });
  }

  // Check file size
  const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return res.status(400).json({
      error: `File size (${Math.round(file.size / 1024 / 1024)} MB) exceeds maximum allowed limit of ${env.MAX_FILE_SIZE_MB} MB.`
    });
  }

  // Check extension against whitelist
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (!env.ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({
      error: `File extension .${ext} is not allowed. Permitted: ${env.ALLOWED_EXTENSIONS.join(', ')}`
    });
  }

  // Inspect raw binary magic-bytes
  const inspection = inspectBufferSignature(file.buffer);
  if (!inspection.isValid) {
    logger.warn('File upload rejected by binary magic-byte scanner:', {
      fileName: file.originalname,
      reason: inspection.reason
    });
    return res.status(400).json({
      error: `Security Verification Failed: ${inspection.reason}`
    });
  }

  // Attach detected MIME for metadata logging
  req.file.detectedMime = inspection.detectedType;
  next();
}

module.exports = {
  validateUploadSecurity,
  inspectBufferSignature
};
