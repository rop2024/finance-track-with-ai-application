const mongoose = require('mongoose');

class SuggestionValidator {
  /**
   * Validate suggestion data
   */
  validateSuggestion(data) {
    const errors = [];

    // Required fields
    if (!data.type) {
      errors.push('Suggestion type is required');
    }

    if (!data.title) {
      errors.push('Title is required');
    } else if (data.title.length < 5 || data.title.length > 200) {
      errors.push('Title must be between 5 and 200 characters');
    }

    if (!data.description) {
      errors.push('Description is required');
    } else if (data.description.length < 10 || data.description.length > 1000) {
      errors.push('Description must be between 10 and 1000 characters');
    }

    if (!data.proposedChanges) {
      errors.push('Proposed changes are required');
    }

    // Type-specific validation
    if (data.type) {
      const typeErrors = this.validateByType(data);
      errors.push(...typeErrors);
    }

    // Impact validation
    if (data.estimatedImpact) {
      const impactErrors = this.validateImpact(data.estimatedImpact);
      errors.push(...impactErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Type-specific validation
   */
  validateByType(data) {
    const errors = [];

    switch(data.type) {
      case 'budget_adjustment':
        if (!data.proposedChanges?.budgetId) {
          errors.push('Budget ID is required for budget adjustment');
        }
        if (!data.proposedChanges?.newAmount) {
          errors.push('New amount is required for budget adjustment');
        } else if (data.proposedChanges.newAmount < 0) {
          errors.push('Budget amount cannot be negative');
        }
        break;

      case 'savings_increase':
        if (!data.proposedChanges?.goalId) {
          errors.push('Goal ID is required for savings increase');
        }
        if (!data.proposedChanges?.amount) {
          errors.push('Amount is required for savings increase');
        } else if (data.proposedChanges.amount < 0) {
          errors.push('Savings amount cannot be negative');
        }
        break;

      case 'subscription_cancellation':
        if (!data.proposedChanges?.subscriptionId) {
          errors.push('Subscription ID is required for cancellation');
        }
        break;

      case 'category_creation':
        if (!data.proposedChanges?.name) {
          errors.push('Category name is required');
        } else if (data.proposedChanges.name.length < 2 || data.proposedChanges.name.length > 50) {
          errors.push('Category name must be between 2 and 50 characters');
        }
        if (data.proposedChanges?.type && !['need', 'want', 'saving', 'fixed', 'income'].includes(data.proposedChanges.type)) {
          errors.push('Invalid category type');
        }
        break;

      case 'budget_creation':
        if (!data.proposedChanges?.categoryId) {
          errors.push('Category ID is required for budget creation');
        }
        if (!data.proposedChanges?.amount) {
          errors.push('Budget amount is required');
        } else if (data.proposedChanges.amount < 0) {
          errors.push('Budget amount cannot be negative');
        }
        if (data.proposedChanges?.period && !['weekly', 'monthly', 'yearly'].includes(data.proposedChanges.period)) {
          errors.push('Invalid budget period');
        }
        break;

      case 'goal_adjustment':
        if (!data.proposedChanges?.goalId) {
          errors.push('Goal ID is required for goal adjustment');
        }
        if (!data.proposedChanges?.newTargetAmount && !data.proposedChanges?.newTargetDate) {
          errors.push('Either new target amount or date is required');
        }
        break;

      case 'transaction_categorization':
        if (!data.proposedChanges?.transactionId) {
          errors.push('Transaction ID is required');
        }
        if (!data.proposedChanges?.newCategoryId) {
          errors.push('New category ID is required');
        }
        break;
    }

    return errors;
  }

  /**
   * Validate impact data
   */
  validateImpact(impact) {
    const errors = [];

    if (impact.amount !== undefined && (typeof impact.amount !== 'number' || isNaN(impact.amount))) {
      errors.push('Impact amount must be a valid number');
    }

    if (impact.percentage !== undefined && 
        (typeof impact.percentage !== 'number' || impact.percentage < -100 || impact.percentage > 100)) {
      errors.push('Impact percentage must be between -100 and 100');
    }

    if (impact.confidence !== undefined && 
        (typeof impact.confidence !== 'number' || impact.confidence < 0 || impact.confidence > 100)) {
      errors.push('Confidence must be between 0 and 100');
    }

    if (impact.timeframe && !['immediate', 'daily', 'weekly', 'monthly', 'yearly'].includes(impact.timeframe)) {
      errors.push('Invalid impact timeframe');
    }

    return errors;
  }

  /**
   * Validate suggestion for approval
   */
  validateForApproval(suggestion) {
    const errors = [];

    if (!suggestion) {
      errors.push('Suggestion not found');
      return errors;
    }

    if (suggestion.status !== 'pending') {
      errors.push(`Suggestion cannot be approved (status: ${suggestion.status})`);
    }

    if (suggestion.metadata?.expiresAt && new Date() > suggestion.metadata.expiresAt) {
      errors.push('Suggestion has expired');
    }

    // Check prerequisites
    if (suggestion.prerequisites) {
      const missingPrereqs = suggestion.prerequisites
        .filter(p => !p.satisfied)
        .map(p => p.type);
      
      if (missingPrereqs.length > 0) {
        errors.push(`Prerequisites not met: ${missingPrereqs.join(', ')}`);
      }
    }

    // Check conflicts
    if (suggestion.conflicts && suggestion.conflicts.length > 0) {
      errors.push(`Suggestion has ${suggestion.conflicts.length} unresolved conflicts`);
    }

    return errors;
  }

  /**
   * Validate for application
   */
  validateForApplication(suggestion) {
    const errors = [];

    if (!suggestion) {
      errors.push('Suggestion not found');
      return errors;
    }

    if (suggestion.status !== 'approved') {
      errors.push(`Suggestion must be approved before applying (current: ${suggestion.status})`);
    }

    if (suggestion.metadata?.expiresAt && new Date() > suggestion.metadata.expiresAt) {
      errors.push('Suggestion has expired');
    }

    if (suggestion.executionDetails?.executedAt) {
      errors.push('Suggestion has already been applied');
    }

    return errors;
  }

  /**
   * Validate for rollback
   */
  validateForRollback(suggestion) {
    const errors = [];

    if (!suggestion) {
      errors.push('Suggestion not found');
      return errors;
    }

    if (suggestion.status !== 'applied') {
      errors.push(`Only applied suggestions can be rolled back (current: ${suggestion.status})`);
    }

    // Check if rollback is possible based on type
    if (suggestion.type === 'category_creation') {
      errors.push('Category creation cannot be rolled back if transactions exist');
    }

    return errors;
  }

  /**
   * Validate data references exist
   */
  async validateReferences(suggestion, userId) {
    const errors = [];

    switch(suggestion.type) {
      case 'budget_adjustment':
      case 'budget_creation':
        if (suggestion.proposedChanges?.budgetId) {
          const Budget = mongoose.model('Budget');
          const budget = await Budget.findOne({
            _id: suggestion.proposedChanges.budgetId,
            userId
          });
          if (!budget) errors.push('Referenced budget not found');
        }
        break;

      case 'savings_increase':
      case 'goal_adjustment':
        if (suggestion.proposedChanges?.goalId) {
          const SavingsGoal = mongoose.model('SavingsGoal');
          const goal = await SavingsGoal.findOne({
            _id: suggestion.proposedChanges.goalId,
            userId
          });
          if (!goal) errors.push('Referenced savings goal not found');
        }
        break;

      case 'subscription_cancellation':
        if (suggestion.proposedChanges?.subscriptionId) {
          const Subscription = mongoose.model('Subscription');
          const sub = await Subscription.findOne({
            _id: suggestion.proposedChanges.subscriptionId,
            userId
          });
          if (!sub) errors.push('Referenced subscription not found');
        }
        break;

      case 'transaction_categorization':
        if (suggestion.proposedChanges?.transactionId) {
          const Transaction = mongoose.model('Transaction');
          const transaction = await Transaction.findOne({
            _id: suggestion.proposedChanges.transactionId,
            userId
          });
          if (!transaction) errors.push('Referenced transaction not found');
        }
        break;
    }

    return errors;
  }

  /**
   * Check for duplicate suggestions
   */
  async checkForDuplicates(userId, type, proposedChanges) {
    const PendingSuggestion = mongoose.model('PendingSuggestion');
    
    const query = {
      userId,
      type,
      status: { $in: ['pending', 'approved'] }
    };

    // Add type-specific matching
    switch(type) {
      case 'budget_adjustment':
        query['proposedChanges.budgetId'] = proposedChanges.budgetId;
        break;
      case 'savings_increase':
        query['proposedChanges.goalId'] = proposedChanges.goalId;
        break;
      case 'subscription_cancellation':
        query['proposedChanges.subscriptionId'] = proposedChanges.subscriptionId;
        break;
      case 'category_creation':
        query['proposedChanges.name'] = proposedChanges.name;
        break;
    }

    const existing = await PendingSuggestion.findOne(query);
    
    return {
      isDuplicate: !!existing,
      existingSuggestion: existing
    };
  }
}

module.exports = new SuggestionValidator();