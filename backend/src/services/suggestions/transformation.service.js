const mongoose = require('mongoose');
const Budget = require('../../models/Budget');
const SavingsGoal = require('../../models/SavingsGoal');
const Subscription = require('../../models/Subscription');
const Category = require('../../models/Category');
const Transaction = require('../../models/Transaction');
const AuditUtils = require('../../utils/audit.utils');

class TransformationService {
  constructor() {
    this.transformers = {
      budget_adjustment: this.transformBudgetAdjustment,
      savings_increase: this.transformSavingsIncrease,
      subscription_cancellation: this.transformSubscriptionCancellation,
      category_creation: this.transformCategoryCreation,
      budget_creation: this.transformBudgetCreation,
      goal_adjustment: this.transformGoalAdjustment,
      transaction_categorization: this.transformTransactionCategorization
    };
  }

  /**
   * Apply changes from suggestion
   */
  async applyChanges(suggestion, userId, options = {}) {
    const { session } = options;
    const transformer = this.transformers[suggestion.type];

    if (!transformer) {
      throw new Error(`No transformer for type: ${suggestion.type}`);
    }

    try {
      const result = await transformer.call(
        this,
        suggestion,
        userId,
        options
      );

      // Log the transformation
      await AuditUtils.logAction({
        userId,
        suggestionId: suggestion._id,
        action: 'transformed',
        actor: { type: 'system' },
        newState: result,
        metadata: { type: suggestion.type }
      }, session);

      return {
        success: true,
        data: result,
        transactionIds: result.transactionIds || []
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
   * Transform budget adjustment
   */
  async transformBudgetAdjustment(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const budget = await Budget.findOne({
      _id: changes.budgetId,
      userId
    }).session(session);

    if (!budget) {
      throw new Error('Budget not found');
    }

    const oldAmount = budget.amount;
    budget.amount = changes.newAmount;
    budget.flexibility = changes.flexibility || budget.flexibility;
    
    // Add note about adjustment
    budget.notes = budget.notes 
      ? `${budget.notes}\nAI suggested adjustment from $${oldAmount} to $${changes.newAmount} on ${new Date().toLocaleDateString()}`
      : `AI suggested adjustment from $${oldAmount} to $${changes.newAmount} on ${new Date().toLocaleDateString()}`;

    await budget.save({ session });

    return {
      budgetId: budget._id,
      oldAmount,
      newAmount: changes.newAmount,
      adjustment: changes.newAmount - oldAmount
    };
  }

  /**
   * Transform savings increase
   */
  async transformSavingsIncrease(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const goal = await SavingsGoal.findOne({
      _id: changes.goalId,
      userId
    }).session(session);

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    // Create auto-save configuration if enabled
    if (changes.enableAutoSave) {
      goal.autoSave = {
        enabled: true,
        amount: changes.amount,
        frequency: changes.frequency || 'monthly',
        dayOfMonth: changes.dayOfMonth || 1,
        sourceAccount: changes.sourceAccount
      };
    }

    // Record the suggested increase
    goal.metadata = {
      ...goal.metadata,
      lastAISuggestion: {
        amount: changes.amount,
        date: new Date(),
        type: 'increase'
      }
    };

    await goal.save({ session });

    return {
      goalId: goal._id,
      newAutoSave: goal.autoSave,
      suggestedAmount: changes.amount
    };
  }

  /**
   * Transform subscription cancellation
   */
  async transformSubscriptionCancellation(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const subscription = await Subscription.findOne({
      _id: changes.subscriptionId,
      userId
    }).session(session);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Don't actually cancel - just mark for cancellation at next billing
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    subscription.metadata = {
      ...subscription.metadata,
      cancelledByAI: true,
      cancellationDate: new Date(),
      reason: changes.reason
    };

    await subscription.save({ session });

    // Create a transaction record for the cancellation note
    const transaction = new Transaction({
      userId,
      amount: 0,
      type: 'expense',
      categoryId: subscription.categoryId,
      description: `Subscription cancelled: ${subscription.name}`,
      date: new Date(),
      status: 'completed',
      isRecurring: false,
      subscriptionId: subscription._id,
      notes: `Cancelled based on AI suggestion. Previous amount: $${subscription.amount}`
    });

    await transaction.save({ session });

    return {
      subscriptionId: subscription._id,
      cancelled: true,
      monthlySavings: subscription.amount,
      transactionId: transaction._id
    };
  }

  /**
   * Transform category creation
   */
  async transformCategoryCreation(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    // Check if category already exists
    const existing = await Category.findOne({
      userId,
      name: changes.name
    }).session(session);

    if (existing) {
      throw new Error('Category already exists');
    }

    const category = new Category({
      userId,
      name: changes.name,
      type: changes.type || 'expense',
      icon: changes.icon || 'default-icon',
      color: changes.color || '#808080',
      monthlyBudget: changes.monthlyBudget,
      metadata: {
        description: changes.description,
        createdByAI: true,
        originalSuggestion: suggestion._id
      }
    });

    await category.save({ session });

    return {
      categoryId: category._id,
      name: category.name,
      type: category.type
    };
  }

  /**
   * Transform budget creation
   */
  async transformBudgetCreation(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    // Check if budget already exists for category
    const existing = await Budget.findOne({
      userId,
      categoryId: changes.categoryId,
      period: changes.period,
      isActive: true
    }).session(session);

    if (existing) {
      throw new Error('Budget already exists for this category');
    }

    const budget = new Budget({
      userId,
      name: changes.name || `Budget for ${changes.categoryName}`,
      period: changes.period || 'monthly',
      categoryId: changes.categoryId,
      amount: changes.amount,
      flexibility: changes.flexibility || 'flexible',
      startDate: changes.startDate || new Date(),
      isActive: true,
      alerts: {
        enabled: true,
        threshold: 80
      },
      metadata: {
        createdByAI: true,
        originalSuggestion: suggestion._id
      }
    });

    await budget.save({ session });

    return {
      budgetId: budget._id,
      categoryId: changes.categoryId,
      amount: budget.amount,
      period: budget.period
    };
  }

  /**
   * Transform goal adjustment
   */
  async transformGoalAdjustment(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const goal = await SavingsGoal.findOne({
      _id: changes.goalId,
      userId
    }).session(session);

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    const oldTarget = goal.targetAmount;
    const oldTargetDate = goal.targetDate;

    if (changes.newTargetAmount) {
      goal.targetAmount = changes.newTargetAmount;
    }

    if (changes.newTargetDate) {
      goal.targetDate = new Date(changes.newTargetDate);
    }

    if (changes.priority) {
      goal.priority = changes.priority;
    }

    goal.metadata = {
      ...goal.metadata,
      lastAIAdjustment: {
        oldTarget,
        newTarget: goal.targetAmount,
        oldDate: oldTargetDate,
        newDate: goal.targetDate,
        date: new Date(),
        reason: changes.reason
      }
    };

    await goal.save({ session });

    return {
      goalId: goal._id,
      oldTarget,
      newTarget: goal.targetAmount,
      oldTargetDate,
      newTargetDate: goal.targetDate
    };
  }

  /**
   * Transform transaction categorization
   */
  async transformTransactionCategorization(suggestion, userId, options) {
    const { session } = options;
    const changes = suggestion.proposedChanges;

    const transaction = await Transaction.findOne({
      _id: changes.transactionId,
      userId
    }).session(session);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const oldCategory = transaction.categoryId;
    transaction.categoryId = changes.newCategoryId;
    transaction.metadata = {
      ...transaction.metadata,
      recategorizedByAI: true,
      originalCategory: oldCategory,
      recategorizedAt: new Date(),
      suggestionId: suggestion._id
    };

    await transaction.save({ session });

    return {
      transactionId: transaction._id,
      oldCategory,
      newCategory: changes.newCategoryId
    };
  }

  /**
   * Validate transformation before applying
   */
  async validateTransformation(suggestion, userId) {
    const checks = [];

    switch(suggestion.type) {
      case 'budget_adjustment':
        checks.push(this.validateBudgetAdjustment(suggestion));
        break;
      case 'savings_increase':
        checks.push(this.validateSavingsIncrease(suggestion));
        break;
      case 'subscription_cancellation':
        checks.push(this.validateSubscriptionCancellation(suggestion));
        break;
      case 'category_creation':
        checks.push(this.validateCategoryCreation(suggestion, userId));
        break;
    }

    const results = await Promise.all(checks);
    const failed = results.filter(r => !r.valid);

    return {
      valid: failed.length === 0,
      errors: failed.map(f => f.reason),
      warnings: results.filter(r => r.warning).map(r => r.warning)
    };
  }

  /**
   * Validate budget adjustment
   */
  async validateBudgetAdjustment(suggestion) {
    const changes = suggestion.proposedChanges;

    if (!changes.budgetId) {
      return { valid: false, reason: 'Budget ID required' };
    }

    if (!changes.newAmount || changes.newAmount < 0) {
      return { valid: false, reason: 'Invalid amount' };
    }

    if (Math.abs(changes.newAmount - changes.oldAmount) > 1000) {
      return {
        valid: true,
        warning: 'Large budget adjustment detected'
      };
    }

    return { valid: true };
  }

  /**
   * Validate savings increase
   */
  async validateSavingsIncrease(suggestion) {
    const changes = suggestion.proposedChanges;

    if (!changes.goalId) {
      return { valid: false, reason: 'Goal ID required' };
    }

    if (!changes.amount || changes.amount < 0) {
      return { valid: false, reason: 'Invalid amount' };
    }

    if (changes.amount > 1000) {
      return {
        valid: true,
        warning: 'Large savings increase may impact cash flow'
      };
    }

    return { valid: true };
  }

  /**
   * Validate subscription cancellation
   */
  async validateSubscriptionCancellation(suggestion) {
    const changes = suggestion.proposedChanges;

    if (!changes.subscriptionId) {
      return { valid: false, reason: 'Subscription ID required' };
    }

    return { valid: true };
  }

  /**
   * Validate category creation
   */
  async validateCategoryCreation(suggestion, userId) {
    const changes = suggestion.proposedChanges;

    if (!changes.name) {
      return { valid: false, reason: 'Category name required' };
    }

    // Check for existing category
    const existing = await Category.findOne({
      userId,
      name: changes.name
    });

    if (existing) {
      return { valid: false, reason: 'Category already exists' };
    }

    return { valid: true };
  }

  /**
   * Simulate transformation (preview)
   */
  async simulateTransformation(suggestion, userId) {
    // Create a dry run without saving
    const clone = JSON.parse(JSON.stringify(suggestion));

    try {
      switch(suggestion.type) {
        case 'budget_adjustment':
          return this.simulateBudgetAdjustment(clone);
        case 'savings_increase':
          return this.simulateSavingsIncrease(clone);
        case 'subscription_cancellation':
          return this.simulateSubscriptionCancellation(clone);
        default:
          return {
            success: true,
            message: 'Preview available after applying'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Simulate budget adjustment
   */
  simulateBudgetAdjustment(suggestion) {
    const changes = suggestion.proposedChanges;
    const difference = changes.newAmount - changes.oldAmount;

    return {
      before: { amount: changes.oldAmount },
      after: { amount: changes.newAmount },
      difference,
      percentageChange: (difference / changes.oldAmount) * 100,
      impact: difference > 0 
        ? `Budget increased by $${difference}`
        : `Budget decreased by $${Math.abs(difference)}`
    };
  }

  /**
   * Simulate savings increase
   */
  simulateSavingsIncrease(suggestion) {
    const changes = suggestion.proposedChanges;

    return {
      before: { autoSave: changes.oldAutoSave },
      after: { autoSave: changes.amount },
      monthlyImpact: changes.amount,
      yearlyImpact: changes.amount * 12
    };
  }

  /**
   * Simulate subscription cancellation
   */
  simulateSubscriptionCancellation(suggestion) {
    const changes = suggestion.proposedChanges;

    return {
      subscription: changes.name,
      monthlySavings: changes.amount,
      yearlySavings: changes.amount * 12,
      impact: `Save $${changes.amount} per month`
    };
  }
}

module.exports = new TransformationService();