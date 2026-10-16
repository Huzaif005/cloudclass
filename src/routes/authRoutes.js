/**
 * ============================================================================
 * CLOUDCLASS - AUTHENTICATION ROUTES
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken, requireAuth } = require('../middleware/auth');

router.post('/login', authLimiter, authController.login);
router.post('/register', authLimiter, authController.register);
router.get('/me', authenticateToken, requireAuth, authController.getMe);

module.exports = router;
