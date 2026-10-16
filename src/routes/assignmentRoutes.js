/**
 * ============================================================================
 * CLOUDCLASS - ASSIGNMENT ROUTES
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken, requireAuth, requireRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All assignment routes pass through API rate limiter & optional auth
router.use(apiLimiter);
router.use(authenticateToken);

router.get('/', assignmentController.getAll);
router.get('/:id', assignmentController.getById);
router.post('/', requireAuth, requireRole('faculty', 'admin'), assignmentController.create);
router.put('/:id', requireAuth, requireRole('faculty', 'admin'), assignmentController.update);

module.exports = router;
