const mongoose = require('mongoose');
const PendingSuggestion = require('../../models/PendingSuggestion');
const SuggestionLog = require('../../models/SuggestionLog');
const ApprovalHandler = require('./approval.handler');
const TransformationService = require('./transformation.service');
const RollbackService = require('./rollback.service');
const NotificationService = require('./notification.service');
const SuggestionValidator = require('./validators/suggestion.validator');
const ActionValidator = require('./validators/action.validator');
const AuditUtils = require('../../utils/audit.utils');
const TransactionUtils = require('../../utils/transaction.utils');

class SuggestionManager {
  constructor() {
    this.approvalHandler = ApprovalHandler;
    this.transformer = TransformationService;
    this.rollback = RollbackService;
    this.notifier = NotificationService;
    this.validator = SuggestionValidator;
    this.actionValidator = ActionValidator;
  }

  /**
   * Create a new suggestion from AI insight
   */
  async createSuggestion(userId, insight, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate suggestion data
      const validation = this.validator.validateSuggestion(insight);
      if (!validation.isValid) {
        throw new Error(`Invalid suggestion: ${validation.errors.join(', ')}`);
      }

      // Check for existing similar suggestions
      const existing = await PendingSuggestion.findOne({
        userId,
        type: insight.type,
        status: { $in: ['pending', 'approved'] },
        'proposedChanges.categoryId': insight.proposedChanges?.categoryId
      }).session(session);

      if (existing) {
        // Update existing suggestion instead of creating new
        const updated = await this.updateExistingSuggestion(existing, insight, session);
        await session.commitTransaction();
        return updated;
      }

      // Create new suggestion
      const suggestion = new PendingSuggestion({
        userId,
        insightId: insight._id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        currentState: await this.captureCurrentState(userId, insight),
        proposedChanges: insight.proposedChanges,
        estimatedImpact: insight.estimatedImpact,
        prerequisites: await this.determinePrerequisites(userId, insight),
        metadata: {
          source: insight.metadata?.source || 'ai',
          priority: this.calculatePriority(insight),
          riskLevel: this.assessRisk(insight),
          estimatedSavings: insight.estimatedImpact?.amount,
          category: insight.proposedChanges?.category,
          tags: insight.metadata?.tags || [],
          version: 1
        }
      });

      await suggestion.save({ session });

      // Check for conflicts
      await suggestion.checkConflicts();

      // Log creation
      await AuditUtils.logAction({
        userId,
        suggestionId: suggestion._id,
        action: 'created',
        actor: { type: 'ai', id: insight._id },
        newState: suggestion.toObject(),
        metadata: { source: insight.metadata?.source }
      }, session);

      // Send notification
      await this.notifier.notifyNewSuggestion(suggestion);

      await session.commitTransaction();

      return suggestion;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get pending suggestions for user
   */
  async getPendingSuggestions(userId, options = {}) {
    const {
      types = [],
      limit = 50,
      includeExpired = false,
      sortBy = 'priority'
    } = options;

    const query = {
      userId,
      status: { $in: ['pending', 'approved', 'conflict'] }
    };

    if (!includeExpired) {
      query['metadata.expiresAt'] = { $gt: new Date() };
    }

    if (types.length > 0) {
      query.type = { $in: types };
    }

    const sort = {};
    if (sortBy === 'priority') {
      sort['metadata.priority'] = -1;
      sort['estimatedImpact.amount'] = -1;
    } else if (sortBy === 'date') {
      sort.createdAt = -1;
    }

    const suggestions = await PendingSuggestion.find(query)
      .sort(sort)
      .limit(limit)
      .populate('insightId')
      .lean();

    // Check prerequisites for each
    for (const suggestion of suggestions) {
      const prereqCheck = await this.checkPrerequisites(suggestion);
      suggestion.prerequisitesMet = prereqCheck.allMet;
      suggestion.missingPrerequisites = prereqCheck.missing;
    }

    return suggestions;
  }

  /**
   * Get suggestion by ID
   */
  async getSuggestion(suggestionId, userId) {
    const suggestion = await PendingSuggestion.findOne({
      _id: suggestionId,
      userId
    }).populate('insightId');

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Mark as viewed
    await suggestion.markAsViewed();

    // Log view
    await AuditUtils.logAction({
      userId,
      suggestionId: suggestion._id,
      action: 'viewed',
      actor: { type: 'user', id: userId }
    });

    return suggestion;
  }

  /**
   * Approve a suggestion
   */
  async approveSuggestion(suggestionId, userId, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const suggestion = await PendingSuggestion.findOne({
        _id: suggestionId,
        userId
      }).session(session);

      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      if (suggestion.status !== 'pending') {
        throw new Error(`Cannot approve suggestion with status: ${suggestion.status}`);
      }

      // Check prerequisites
      const prereqCheck = await this.checkPrerequisites(suggestion);
      if (!prereqCheck.allMet) {
        throw new Error(`Prerequisites not met: ${prereqCheck.missing.join(', ')}`);
      }

      // Check conflicts
      if (suggestion.conflicts.length > 0) {
        suggestion.status = 'conflict';
        await suggestion.save({ session });
        throw new Error('Suggestion has conflicts that need resolution');
      }

      // Process approval
      const approvalResult = await this.approvalHandler.processApproval(
        suggestion,
        userId,
        options,
        session
      );

      suggestion.status = 'approved';
      suggestion.approvalDetails = {
        approvedAt: new Date(),
        approvedBy: 'user',
        method: options.method || 'click',
        notes: options.notes,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      };

      await suggestion.save({ session });

      // Log approval
      await AuditUtils.logAction({
        userId,
        suggestionId: suggestion._id,
        action: 'approved',
        actor: { type: 'user', id: userId },
        previousState: { status: 'pending' },
        newState: { status: 'approved' },
        metadata: approvalResult
      }, session);

      // Send notification
      await this.notifier.notifyApproved(suggestion);

      await session.commitTransaction();

      return suggestion;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Reject a suggestion
   */
  async rejectSuggestion(suggestionId, userId, reason = '', options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const suggestion = await PendingSuggestion.findOne({
        _id: suggestionId,
        userId
      }).session(session);

      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      const previousStatus = suggestion.status;
      suggestion.status = 'rejected';
      suggestion.reviewDetails.userFeedback = reason;
      suggestion.reviewDetails.userRating = options.rating;

      await suggestion.save({ session });

      // Log rejection
      await AuditUtils.logAction({
        userId,
        suggestionId: suggestion._id,
        action: 'rejected',
        actor: { type: 'user', id: userId },
        previousState: { status: previousStatus },
        newState: { status: 'rejected' },
        metadata: { reason, rating: options.rating }
      }, session);

      // Send notification
      await this.notifier.notifyRejected(suggestion, reason);

      await session.commitTransaction();

      return suggestion;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Apply an approved suggestion
   */
  async applySuggestion(suggestionId, userId, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const suggestion = await PendingSuggestion.findOne({
        _id: suggestionId,
        userId,
        status: 'approved'
      }).session(session);

      if (!suggestion) {
        throw new Error('Approved suggestion not found');
      }

      if (!suggestion.canBeApplied) {
        throw new Error('Suggestion cannot be applied');
      }

      // Record execution start
      suggestion.executionDetails = {
        executedAt: new Date(),
        executedBy: 'system',
        results: []
      };

      // Transform and apply suggestion
      const applyResult = await this.transformer.applyChanges(
        suggestion,
        userId,
        { session, ...options }
      );

      if (applyResult.success) {
        suggestion.status = 'applied';
        suggestion.executionDetails.results.push({
          step: 'apply',
          success: true,
          data: applyResult.data,
          timestamp: new Date()
        });

        if (applyResult.transactionIds) {
          suggestion.executionDetails.transactionIds = applyResult.transactionIds;
        }

        // Log success
        await AuditUtils.logAction({
          userId,
          suggestionId: suggestion._id,
          action: 'applied',
          actor: { type: 'system' },
          previousState: { status: 'approved' },
          newState: { status: 'applied' },
          metadata: applyResult
        }, session);

        // Send notification
        await this.notifier.notifyApplied(suggestion, applyResult);

      } else {
        suggestion.status = 'failed';
        suggestion.executionDetails.results.push({
          step: 'apply',
          success: false,
          error: applyResult.error,
          timestamp: new Date()
        });
        suggestion.executionDetails.error = applyResult.error;

        // Log failure
        await AuditUtils.logAction({
          userId,
          suggestionId: suggestion._id,
          action: 'failed',
          actor: { type: 'system' },
          previousState: { status: 'approved' },
          newState: { status: 'failed' },
          outcome: { success: false, error: applyResult.error }
        }, session);
      }

      await suggestion.save({ session });
      await session.commitTransaction();

      return suggestion;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Rollback an applied suggestion
   */
  async rollbackSuggestion(suggestionId, userId, reason = '') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const suggestion = await PendingSuggestion.findOne({
        _id: suggestionId,
        userId,
        status: 'applied'
      }).session(session);

      if (!suggestion) {
        throw new Error('Applied suggestion not found');
      }

      // Perform rollback
      const rollbackResult = await this.rollback.rollbackChanges(
        suggestion,
        userId,
        { session, reason }
      );

      if (rollbackResult.success) {
        suggestion.status = 'rolled_back';
        suggestion.rollbackDetails = {
          rolledBackAt: new Date(),
          rolledBackBy: 'user',
          reason,
          originalState: suggestion.currentState,
          rollbackTransactionIds: rollbackResult.transactionIds,
          success: true
        };

        // Log rollback
        await AuditUtils.logAction({
          userId,
          suggestionId: suggestion._id,
          action: 'rolled_back',
          actor: { type: 'user', id: userId },
          previousState: { status: 'applied' },
          newState: { status: 'rolled_back' },
          metadata: { reason, result: rollbackResult }
        }, session);

        // Send notification
        await this.notifier.notifyRolledBack(suggestion, reason);

      } else {
        suggestion.rollbackDetails = {
          rolledBackAt: new Date(),
          rolledBackBy: 'user',
          reason,
          success: false,
          error: rollbackResult.error
        };

        // Log rollback failure
        await AuditUtils.logAction({
          userId,
          suggestionId: suggestion._id,
          action: 'rolled_back',
          actor: { type: 'user', id: userId },
          previousState: { status: 'applied' },
          newState: { status: 'applied' },
          outcome: { success: false, error: rollbackResult.error },
          metadata: { reason }
        }, session);
      }

      await suggestion.save({ session });
      await session.commitTransaction();

      return suggestion;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel a pending suggestion
   */
  async cancelSuggestion(suggestionId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const suggestion = await PendingSuggestion.findOneAndUpdate(
        { _id: suggestionId, userId, status: 'pending' },
        { status: 'cancelled' },
        { new: true, session }
      );

      if (!suggestion) {
        throw new Error('Pending suggestion not found');
      }

      await AuditUtils.logAction({
        userId,
        suggestionId: suggestion._id,
        action: 'cancelled',
        actor: { type: 'user', id: userId },
        previousState: { status: 'pending' },
        newState: { status: 'cancelled' }
      }, session);

      await session.commitTransaction();
      return suggestion;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Capture current state before change
   */
  async captureCurrentState(userId, insight) {
    const state = {};

    switch(insight.type) {
      case 'budget_adjustment':
        const Budget = mongoose.model('Budget');
        const budget = await Budget.findOne({
          userId,
          _id: insight.proposedChanges?.budgetId
        }).lean();
        state.budget = budget;
        break;

      case 'savings_increase':
        const SavingsGoal = mongoose.model('SavingsGoal');
        const goal = await SavingsGoal.findOne({
          userId,
          _id: insight.proposedChanges?.goalId
        }).lean();
        state.goal = goal;
        break;

      case 'subscription_cancellation':
        const Subscription = mongoose.model('Subscription');
        const subscription = await Subscription.findOne({
          userId,
          _id: insight.proposedChanges?.subscriptionId
        }).lean();
        state.subscription = subscription;
        break;

      case 'category_creation':
        // No current state for creation
        state.existingCategories = await mongoose.model('Category')
          .find({ userId })
          .lean();
        break;
    }

    return state;
  }

  /**
   * Determine prerequisites for suggestion
   */
  async determinePrerequisites(userId, insight) {
    const prerequisites = [];

    switch(insight.type) {
      case 'budget_adjustment':
        prerequisites.push({
          type: 'has_budget',
          satisfied: false,
          details: { budgetId: insight.proposedChanges?.budgetId }
        });
        break;

      case 'savings_increase':
        prerequisites.push({
          type: 'has_goal',
          satisfied: false,
          details: { goalId: insight.proposedChanges?.goalId }
        });
        break;

      case 'subscription_cancellation':
        prerequisites.push({
          type: 'has_subscription',
          satisfied: false,
          details: { subscriptionId: insight.proposedChanges?.subscriptionId }
        });
        break;

      case 'category_creation':
        prerequisites.push({
          type: 'no_conflict',
          satisfied: false,
          details: { categoryName: insight.proposedChanges?.name }
        });
        break;
    }

    return prerequisites;
  }

  /**
   * Calculate priority based on impact
   */
  calculatePriority(insight) {
    const impact = insight.estimatedImpact?.amount || 0;
    const confidence = insight.estimatedImpact?.confidence || 50;

    if (impact > 1000 && confidence > 80) return 'critical';
    if (impact > 500 && confidence > 70) return 'high';
    if (impact > 100 && confidence > 60) return 'medium';
    return 'low';
  }

  /**
   * Assess risk level of suggestion
   */
  assessRisk(insight) {
    const impact = Math.abs(insight.estimatedImpact?.amount || 0);
    const type = insight.type;

    // High risk types
    if (['subscription_cancellation', 'goal_adjustment'].includes(type) && impact > 500) {
      return 'high';
    }

    // Medium risk types
    if (['budget_adjustment', 'savings_increase'].includes(type) && impact > 200) {
      return 'medium';
    }

    // Low risk
    return 'low';
  }

  /**
   * Check prerequisites for suggestion
   */
  async checkPrerequisites(suggestion) {
    const missing = [];

    for (const prereq of suggestion.prerequisites) {
      switch(prereq.type) {
        case 'has_budget':
          const Budget = mongoose.model('Budget');
          const budget = await Budget.findOne({
            userId: suggestion.userId,
            _id: prereq.details?.budgetId
          });
          if (!budget) missing.push(`Budget ${prereq.details?.budgetId} not found`);
          break;

        case 'has_goal':
          const SavingsGoal = mongoose.model('SavingsGoal');
          const goal = await SavingsGoal.findOne({
            userId: suggestion.userId,
            _id: prereq.details?.goalId
          });
          if (!goal) missing.push(`Goal ${prereq.details?.goalId} not found`);
          break;

        case 'min_balance':
          const balance = await suggestion.calculateBalance();
          if (balance < (prereq.details?.amount || 0)) {
            missing.push(`Insufficient balance: need $${prereq.details?.amount}, have $${balance}`);
          }
          break;
      }
    }

    return {
      allMet: missing.length === 0,
      missing
    };
  }

  /**
   * Update existing suggestion
   */
  async updateExistingSuggestion(existing, insight, session) {
    existing.title = insight.title;
    existing.description = insight.description;
    existing.proposedChanges = insight.proposedChanges;
    existing.estimatedImpact = insight.estimatedImpact;
    existing.metadata.version += 1;

    await existing.save({ session });

    await AuditUtils.logAction({
      userId: existing.userId,
      suggestionId: existing._id,
      action: 'updated',
      actor: { type: 'ai', id: insight._id },
      previousState: { version: existing.metadata.version - 1 },
      newState: { version: existing.metadata.version },
      metadata: { reason: 'New insight available' }
    }, session);

    return existing;
  }

  /**
   * Get suggestion statistics
   */
  async getStats(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [suggestions, logs] = await Promise.all([
      PendingSuggestion.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalImpact: { $sum: '$estimatedImpact.amount' },
            avgConfidence: { $avg: '$estimatedImpact.confidence' }
          }
        }
      ]),
      SuggestionLog.getUserActivity(userId, days)
    ]);

    const total = suggestions.reduce((sum, s) => sum + s.count, 0);
    const accepted = suggestions.find(s => s._id === 'applied')?.count || 0;
    const rejected = suggestions.find(s => s._id === 'rejected')?.count || 0;

    return {
      period: { days },
      total,
      accepted,
      rejected,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      byStatus: suggestions,
      activity: logs,
      pendingCount: await PendingSuggestion.countDocuments({
        userId,
        status: 'pending',
        'metadata.expiresAt': { $gt: new Date() }
      })
    };
  }
}

module.exports = new SuggestionManager();