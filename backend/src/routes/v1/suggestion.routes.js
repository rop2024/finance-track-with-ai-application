const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimiter');
const suggestionController = require('../../controllers/suggestion.controller');

// All suggestion routes require authentication
router.use(authenticate);
router.use(apiLimiter);

// Main suggestion endpoints
router.get('/', suggestionController.getPendingSuggestions);
router.get('/stats', suggestionController.getSuggestionStats);
router.post('/validate', suggestionController.validateSuggestion);

// Single suggestion operations
router.get('/:id', suggestionController.getSuggestion);
router.post('/:id/approve', suggestionController.approveSuggestion);
router.post('/:id/reject', suggestionController.rejectSuggestion);
router.post('/:id/apply', suggestionController.applySuggestion);
router.post('/:id/rollback', suggestionController.rollbackSuggestion);
router.post('/:id/cancel', suggestionController.cancelSuggestion);
router.post('/:id/feedback', suggestionController.provideFeedback);
router.get('/:id/audit', suggestionController.getAuditTrail);

// Batch operations
router.post('/batch/approve', suggestionController.batchApprove);

// Approval requirements
router.get('/requirements/:type', suggestionController.getApprovalRequirements);

// Notifications
router.get('/notifications/count', suggestionController.getNotificationCount);
router.patch('/notifications/:id/read', suggestionController.markNotificationRead);
router.post('/notifications/read-all', suggestionController.markAllNotificationsRead);

module.exports = router;