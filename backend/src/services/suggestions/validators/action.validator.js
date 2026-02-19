class ActionValidator {
  /**
   * Validate approve action
   */
  validateApprove(action, context) {
    const errors = [];

    if (!action.suggestionId) {
      errors.push('Suggestion ID is required');
    }

    if (action.method && !['click', 'api', 'email', 'notification'].includes(action.method)) {
      errors.push('Invalid approval method');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate reject action
   */
  validateReject(action, context) {
    const errors = [];

    if (!action.suggestionId) {
      errors.push('Suggestion ID is required');
    }

    if (action.reason && action.reason.length > 500) {
      errors.push('Reason too long (max 500 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate apply action
   */
  validateApply(action, context) {
    const errors = [];

    if (!action.suggestionId) {
      errors.push('Suggestion ID is required');
    }

    if (action.dryRun !== undefined && typeof action.dryRun !== 'boolean') {
      errors.push('dryRun must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate rollback action
   */
  validateRollback(action, context) {
    const errors = [];

    if (!action.suggestionId) {
      errors.push('Suggestion ID is required');
    }

    if (action.reason && action.reason.length > 500) {
      errors.push('Reason too long (max 500 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate batch action
   */
  validateBatchAction(action, context) {
    const errors = [];

    if (!action.suggestionIds || !Array.isArray(action.suggestionIds)) {
      errors.push('suggestionIds array is required');
    } else if (action.suggestionIds.length === 0) {
      errors.push('At least one suggestion ID is required');
    } else if (action.suggestionIds.length > 100) {
      errors.push('Cannot process more than 100 suggestions at once');
    }

    if (!action.action || !['approve', 'reject', 'apply'].includes(action.action)) {
      errors.push('Valid action type is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate action context
   */
  validateContext(context) {
    const errors = [];

    if (context.ipAddress && !this.isValidIP(context.ipAddress)) {
      errors.push('Invalid IP address');
    }

    if (context.userAgent && context.userAgent.length > 500) {
      errors.push('User agent too long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Simple IP validation
   */
  isValidIP(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
  }

  /**
   * Check rate limit for actions
   */
  async checkRateLimit(userId, actionType) {
    const PendingSuggestion = mongoose.model('PendingSuggestion');
    const SuggestionLog = mongoose.model('SuggestionLog');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [recentActions, recentSuggestions] = await Promise.all([
      SuggestionLog.countDocuments({
        userId,
        action: actionType,
        timestamp: { $gte: oneHourAgo }
      }),
      PendingSuggestion.countDocuments({
        userId,
        createdAt: { $gte: oneHourAgo }
      })
    ]);

    const limits = {
      approve: 50,
      reject: 50,
      apply: 20,
      rollback: 10
    };

    const limit = limits[actionType] || 30;

    return {
      allowed: recentActions < limit,
      current: recentActions,
      limit,
      resetAt: new Date(oneHourAgo.getTime() + 60 * 60 * 1000)
    };
  }

  /**
   * Check if user can perform action based on role/permissions
   */
  checkPermissions(user, actionType) {
    const permissions = {
      approve: ['user', 'admin'],
      reject: ['user', 'admin'],
      apply: ['user', 'admin'],
      rollback: ['admin'] // Only admins can rollback
    };

    const allowedRoles = permissions[actionType] || ['user'];
    return allowedRoles.includes(user.role);
  }

  /**
   * Validate action for specific suggestion type
   */
  validateForType(action, suggestion) {
    const errors = [];

    switch(suggestion.type) {
      case 'subscription_cancellation':
        if (action.type === 'apply' && !action.confirmCancellation) {
          errors.push('Must confirm subscription cancellation');
        }
        break;

      case 'budget_adjustment':
        if (action.type === 'apply') {
          const newAmount = suggestion.proposedChanges?.newAmount;
          const oldAmount = suggestion.currentState?.budget?.amount;
          if (newAmount && oldAmount && Math.abs(newAmount - oldAmount) > 1000) {
            errors.push('Large budget adjustment requires additional confirmation');
          }
        }
        break;

      case 'category_creation':
        if (action.type === 'rollback') {
          errors.push('Category creation cannot be rolled back automatically');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ActionValidator();