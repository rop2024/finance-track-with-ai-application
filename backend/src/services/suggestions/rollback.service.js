const mongoose = require('mongoose');
const Budget = require('../../models/Budget');
const SavingsGoal = require('../../models/SavingsGoal');
const Subscription = require('../../models/Subscription');
const Category = require('../../models/Category');
const Transaction = require('../../models/Transaction');
const AuditUtils = require('../../utils/audit.utils');

class RollbackService {
  constructor() {
    this.rollbackStrategies = {
      budget_adjustment: this.rollbackBudgetAdjustment,
      savings_increase: this.rollbackSavingsIncrease,
      subscription_cancellation: this.rollbackSubscriptionCancellation,
      category_creation: this.rollbackCategoryCreation,
      budget_creation: this.rollbackBudgetCreation,
      goal_adjustment: this.rollbackGoalAdjustment,
      transaction_categorization: this.rollbackTransactionCategorization
    };
  }

  /**
   * Rollback changes from an applied suggestion
   */
  async rollbackChanges(suggestion, userId, options = {}) {
    const { session, reason } = options;
    const strategy = this.rollbackStrategies[suggestion.type];

    if (!strategy) {
      throw new Error(`No rollback strategy for type: ${suggestion.type}`);
    }

    try {
      const result = await strategy.call(
        this,
        suggestion,
        userId,
        options
      );

      // Log the rollback
      await AuditUtils.logAction({
        userId,
        suggestionId: suggestion._id,
        action: 'rolled_back',
        actor: { type: 'user', id: userId },
        previousState: { status: 'applied' },
        newState: { status: 'rolled_back' },
        metadata: { reason, result }
      }, session);

      return {
        success: true,
        ...result
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Rollback budget adjustment
   */
  async rollbackBudgetAdjustment(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const budget = await Budget.findOne({
      _id: changes.budgetId,
      userId
    }).session(session);

    if (!budget) {
      throw new Error('Budget not found for rollback');
    }

    // Restore original amount
    budget.amount = changes.oldAmount;
    budget.notes = budget.notes 
      ? `${budget.notes}\nRolled back AI adjustment on ${new Date().toLocaleDateString()}`
      : `Rolled back AI adjustment on ${new Date().toLocaleDateString()}`;

    await budget.save({ session });

    return {
      budgetId: budget._id,
      restoredAmount: changes.oldAmount,
      previousAmount: changes.newAmount
    };
  }

  /**
   * Rollback savings increase
   */
  async rollbackSavingsIncrease(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const goal = await SavingsGoal.findOne({
      _id: changes.goalId,
      userId
    }).session(session);

    if (!goal) {
      throw new Error('Savings goal not found for rollback');
    }

    // Disable auto-save if it was enabled
    if (changes.enableAutoSave) {
      goal.autoSave.enabled = false;
    }

    // Remove the AI suggestion metadata
    delete goal.metadata.lastAISuggestion;

    await goal.save({ session });

    return {
      goalId: goal._id,
      autoSaveDisabled: changes.enableAutoSave || false
    };
  }

  /**
   * Rollback subscription cancellation
   */
  async rollbackSubscriptionCancellation(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const subscription = await Subscription.findOne({
      _id: changes.subscriptionId,
      userId
    }).session(session);

    if (!subscription) {
      throw new Error('Subscription not found for rollback');
    }

    // Reactivate subscription
    subscription.status = 'active';
    subscription.autoRenew = true;
    delete subscription.metadata.cancelledByAI;

    await subscription.save({ session });

    // Create a reversal transaction note
    const transaction = new Transaction({
      userId,
      amount: 0,
      type: 'expense',
      categoryId: subscription.categoryId,
      description: `Subscription reactivated: ${subscription.name}`,
      date: new Date(),
      status: 'completed',
      subscriptionId: subscription._id,
      notes: `Rolled back cancellation suggestion`
    });

    await transaction.save({ session });

    return {
      subscriptionId: subscription._id,
      reactivated: true,
      transactionId: transaction._id
    };
  }

  /**
   * Rollback category creation
   */
  async rollbackCategoryCreation(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    // Check if category has any transactions
    const transactionCount = await Transaction.countDocuments({
      userId,
      categoryId: changes.categoryId
    }).session(session);

    if (transactionCount > 0) {
      throw new Error('Cannot delete category with existing transactions');
    }

    const category = await Category.findOneAndDelete({
      _id: changes.categoryId,
      userId
    }).session(session);

    if (!category) {
      throw new Error('Category not found for rollback');
    }

    return {
      categoryId: changes.categoryId,
      name: category.name,
      deleted: true
    };
  }

  /**
   * Rollback budget creation
   */
  async rollbackBudgetCreation(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const budget = await Budget.findOneAndDelete({
      _id: changes.budgetId,
      userId
    }).session(session);

    if (!budget) {
      throw new Error('Budget not found for rollback');
    }

    return {
      budgetId: changes.budgetId,
      deleted: true
    };
  }

  /**
   * Rollback goal adjustment
   */
  async rollbackGoalAdjustment(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const goal = await SavingsGoal.findOne({
      _id: changes.goalId,
      userId
    }).session(session);

    if (!goal) {
      throw new Error('Savings goal not found for rollback');
    }

    // Restore original values
    if (changes.oldTargetAmount) {
      goal.targetAmount = changes.oldTargetAmount;
    }

    if (changes.oldTargetDate) {
      goal.targetDate = new Date(changes.oldTargetDate);
    }

    if (changes.oldPriority) {
      goal.priority = changes.oldPriority;
    }

    // Remove adjustment metadata
    delete goal.metadata.lastAIAdjustment;

    await goal.save({ session });

    return {
      goalId: goal._id,
      restoredTarget: goal.targetAmount,
      restoredDate: goal.targetDate
    };
  }

  /**
   * Rollback transaction categorization
   */
  async rollbackTransactionCategorization(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const transaction = await Transaction.findOne({
      _id: changes.transactionId,
      userId
    }).session(session);

    if (!transaction) {
      throw new Error('Transaction not found for rollback');
    }

    // Restore original category
    transaction.categoryId = changes.oldCategoryId;
    transaction.metadata = {
      ...transaction.metadata,
      recategorizedByAI: false,
      recategorizedAt: null,
      rolledBackAt: new Date()
    };

    await transaction.save({ session });

    return {
      transactionId: transaction._id,
      restoredCategory: changes.oldCategoryId
    };
  }

  /**
   * Check if rollback is possible
   */
  async canRollback(suggestion, userId) {
    const checks = [];

    switch(suggestion.type) {
      case 'category_creation':
        checks.push(this.canRollbackCategoryCreation(suggestion, userId));
        break;
      case 'budget_creation':
        checks.push(this.canRollbackBudgetCreation(suggestion, userId));
        break;
      default:
        checks.push(Promise.resolve({ canRollback: true }));
    }

    const results = await Promise.all(checks);
    const failed = results.find(r => !r.canRollback);

    return failed || { canRollback: true };
  }

  /**
   * Check if category creation can be rolled back
   */
  async canRollbackCategoryCreation(suggestion, userId) {
    const changes = suggestion.proposedChanges;

    const transactionCount = await Transaction.countDocuments({
      userId,
      categoryId: changes.categoryId
    });

    if (transactionCount > 0) {
      return {
        canRollback: false,
        reason: `Category has ${transactionCount} transactions`
      };
    }

    return { canRollback: true };
  }

  /**
   * Check if budget creation can be rolled back
   */
  async canRollbackBudgetCreation(suggestion, userId) {
    const changes = suggestion.proposedChanges;

    const budget = await Budget.findOne({
      _id: changes.budgetId,
      userId
    });

    if (!budget) {
      return {
        canRollback: false,
        reason: 'Budget not found'
      };
    }

    return { canRollback: true };
  }

  /**
   * Get rollback impact estimation
   */
  estimateRollbackImpact(suggestion) {
    switch(suggestion.type) {
      case 'budget_adjustment':
        return {
          complexity: 'low',
          impact: 'Reverts budget amount to previous value',
          duration: 'immediate'
        };

      case 'subscription_cancellation':
        return {
          complexity: 'medium',
          impact: 'Reactivates subscription, may incur charges',
          duration: 'immediate',
          warning: 'May result in immediate billing'
        };

      case 'category_creation':
        return {
          complexity: 'high',
          impact: 'Permanently deletes category',
          duration: 'permanent',
          warning: 'Cannot be undone if category has transactions'
        };

      default:
        return {
          complexity: 'medium',
          impact: 'Reverts changes from suggestion',
          duration: 'immediate'
        };
    }
  }
}

module.exports = new RollbackService();