const SuggestionManager = require('../services/suggestions/suggestion.manager');
const ApprovalHandler = require('../services/suggestions/approval.handler');
const TransformationService = require('../services/suggestions/transformation.service');
const RollbackService = require('../services/suggestions/rollback.service');
const NotificationService = require('../services/suggestions/notification.service');
const SuggestionValidator = require('../services/suggestions/validators/suggestion.validator');
const ActionValidator = require('../services/suggestions/validators/action.validator');
const { asyncHandler, ServiceError } = require('../middleware/errorHandler');
const AuditUtils = require('../utils/audit.utils');

/**
 * Get all pending suggestions for user
 */
const getPendingSuggestions = asyncHandler(async (req, res) => {
  const { types, limit, includeExpired, sortBy } = req.query;

  const options = {
    types: types ? types.split(',') : [],
    limit: limit ? parseInt(limit) : 50,
    includeExpired: includeExpired === 'true',
    sortBy: sortBy || 'priority'
  };

  const suggestions = await SuggestionManager.getPendingSuggestions(
    req.userId,
    options
  );

  res.json({
    success: true,
    data: suggestions,
    count: suggestions.length
  });
});

/**
 * Get suggestion by ID
 */
const getSuggestion = asyncHandler(async (req, res) => {
  const suggestion = await SuggestionManager.getSuggestion(
    req.params.id,
    req.userId
  );

  if (!suggestion) {
    throw new ServiceError('Suggestion not found', 404);
  }

  // Check prerequisites
  const prereqCheck = await SuggestionManager.checkPrerequisites(suggestion);

  res.json({
    success: true,
    data: {
      ...suggestion.toObject(),
      prerequisitesMet: prereqCheck.allMet,
      missingPrerequisites: prereqCheck.missing
    }
  });
});

/**
 * Approve a suggestion
 */
const approveSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { method, notes, rating } = req.body;

  // Validate action
  const validation = ActionValidator.validateApprove(
    { suggestionId: id, method },
    { ipAddress: req.ip, userAgent: req.get('User-Agent') }
  );

  if (!validation.isValid) {
    throw new ServiceError('Invalid approval request', 400, validation.errors);
  }

  // Check rate limit
  const rateLimit = await ActionValidator.checkRateLimit(req.userId, 'approve');
  if (!rateLimit.allowed) {
    throw new ServiceError('Rate limit exceeded', 429, {
      resetAt: rateLimit.resetAt,
      limit: rateLimit.limit
    });
  }

  const suggestion = await SuggestionManager.approveSuggestion(
    id,
    req.userId,
    {
      method,
      notes,
      rating,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  );

  res.json({
    success: true,
    data: suggestion,
    message: 'Suggestion approved successfully'
  });
});

/**
 * Reject a suggestion
 */
const rejectSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, rating } = req.body;

  // Validate action
  const validation = ActionValidator.validateReject(
    { suggestionId: id, reason },
    { ipAddress: req.ip }
  );

  if (!validation.isValid) {
    throw new ServiceError('Invalid rejection request', 400, validation.errors);
  }

  const suggestion = await SuggestionManager.rejectSuggestion(
    id,
    req.userId,
    reason,
    { rating }
  );

  res.json({
    success: true,
    data: suggestion,
    message: 'Suggestion rejected'
  });
});

/**
 * Apply an approved suggestion
 */
const applySuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dryRun = false } = req.body;

  // Validate action
  const validation = ActionValidator.validateApply(
    { suggestionId: id, dryRun },
    { ipAddress: req.ip }
  );

  if (!validation.isValid) {
    throw new ServiceError('Invalid apply request', 400, validation.errors);
  }

  // Get suggestion first
  const suggestion = await SuggestionManager.getSuggestion(id, req.userId);

  // Validate for application
  const applyValidation = SuggestionValidator.validateForApplication(suggestion);
  if (applyValidation.length > 0) {
    throw new ServiceError('Cannot apply suggestion', 400, applyValidation);
  }

  // Dry run - simulate without saving
  if (dryRun) {
    const simulation = await TransformationService.simulateTransformation(
      suggestion,
      req.userId
    );
    return res.json({
      success: true,
      data: simulation,
      message: 'Dry run completed'
    });
  }

  // Apply for real
  const applied = await SuggestionManager.applySuggestion(id, req.userId);

  res.json({
    success: true,
    data: applied,
    message: 'Suggestion applied successfully'
  });
});

/**
 * Rollback an applied suggestion
 */
const rollbackSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Validate action
  const validation = ActionValidator.validateRollback(
    { suggestionId: id, reason },
    { ipAddress: req.ip }
  );

  if (!validation.isValid) {
    throw new ServiceError('Invalid rollback request', 400, validation.errors);
  }

  // Check if rollback is possible
  const canRollback = await RollbackService.canRollback(
    { _id: id },
    req.userId
  );

  if (!canRollback.canRollback) {
    throw new ServiceError('Cannot rollback suggestion', 400, {
      reason: canRollback.reason
    });
  }

  const rolledBack = await SuggestionManager.rollbackSuggestion(
    id,
    req.userId,
    reason
  );

  res.json({
    success: true,
    data: rolledBack,
    message: 'Suggestion rolled back successfully'
  });
});

/**
 * Cancel a pending suggestion
 */
const cancelSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const cancelled = await SuggestionManager.cancelSuggestion(id, req.userId);

  res.json({
    success: true,
    data: cancelled,
    message: 'Suggestion cancelled'
  });
});

/**
 * Batch approve suggestions
 */
const batchApprove = asyncHandler(async (req, res) => {
  const { suggestionIds } = req.body;

  // Validate batch action
  const validation = ActionValidator.validateBatchAction(
    { suggestionIds, action: 'approve' },
    { ipAddress: req.ip }
  );

  if (!validation.isValid) {
    throw new ServiceError('Invalid batch request', 400, validation.errors);
  }

  const results = [];
  const errors = [];

  for (const id of suggestionIds) {
    try {
      const suggestion = await SuggestionManager.approveSuggestion(
        id,
        req.userId,
        { method: 'batch' }
      );
      results.push({ id, status: 'approved', suggestion });
    } catch (error) {
      errors.push({ id, error: error.message });
    }
  }

  res.json({
    success: errors.length === 0,
    data: {
      approved: results.length,
      failed: errors.length,
      results,
      errors
    },
    message: `Approved ${results.length} suggestions, ${errors.length} failed`
  });
});

/**
 * Get suggestion statistics
 */
const getSuggestionStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const stats = await SuggestionManager.getStats(req.userId, parseInt(days));

  res.json({
    success: true,
    data: stats
  });
});

/**
 * Get audit trail for suggestion
 */
const getAuditTrail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify suggestion exists and belongs to user
  const suggestion = await SuggestionManager.getSuggestion(id, req.userId);
  if (!suggestion) {
    throw new ServiceError('Suggestion not found', 404);
  }

  const auditTrail = await AuditUtils.getSuggestionAuditTrail(id);

  res.json({
    success: true,
    data: auditTrail
  });
});

/**
 * Provide feedback on suggestion
 */
const provideFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment, applied } = req.body;

  const suggestion = await SuggestionManager.getSuggestion(id, req.userId);
  if (!suggestion) {
    throw new ServiceError('Suggestion not found', 404);
  }

  suggestion.reviewDetails = {
    ...suggestion.reviewDetails,
    userRating: rating,
    userFeedback: comment,
    ratedAt: new Date()
  };

  if (applied !== undefined) {
    suggestion.reviewDetails.applied = applied;
  }

  await suggestion.save();

  res.json({
    success: true,
    data: suggestion,
    message: 'Feedback recorded'
  });
});

/**
 * Get approval requirements for suggestion
 */
const getApprovalRequirements = asyncHandler(async (req, res) => {
  const { type } = req.params;

  const requirements = ApprovalHandler.getApprovalRequirements(type);

  res.json({
    success: true,
    data: requirements
  });
});

/**
 * Validate suggestion before creation
 */
const validateSuggestion = asyncHandler(async (req, res) => {
  const { suggestion } = req.body;

  const validation = SuggestionValidator.validateSuggestion(suggestion);
  
  if (suggestion.proposedChanges) {
    const duplicateCheck = await SuggestionValidator.checkForDuplicates(
      req.userId,
      suggestion.type,
      suggestion.proposedChanges
    );
    validation.isDuplicate = duplicateCheck.isDuplicate;
    validation.existingSuggestion = duplicateCheck.existingSuggestion;
  }

  res.json({
    success: validation.isValid,
    data: validation
  });
});

/**
 * Get unread notifications count
 */
const getNotificationCount = asyncHandler(async (req, res) => {
  const unread = await NotificationService.getUnreadNotifications(req.userId);

  res.json({
    success: true,
    data: {
      count: unread.length,
      notifications: unread.slice(0, 5)
    }
  });
});

/**
 * Mark notification as read
 */
const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await NotificationService.markAsRead(id, req.userId);

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
});

/**
 * Mark all notifications as read
 */
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await NotificationService.markAllAsRead(req.userId);

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
});

module.exports = {
  getPendingSuggestions,
  getSuggestion,
  approveSuggestion,
  rejectSuggestion,
  applySuggestion,
  rollbackSuggestion,
  cancelSuggestion,
  batchApprove,
  getSuggestionStats,
  getAuditTrail,
  provideFeedback,
  getApprovalRequirements,
  validateSuggestion,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead
};