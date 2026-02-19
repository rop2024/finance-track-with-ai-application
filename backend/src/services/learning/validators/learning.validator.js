class LearningValidator {
  /**
   * Validate feedback data
   */
  validateFeedback(data) {
    const errors = [];

    if (!data.decision) {
      errors.push('Decision is required');
    } else if (!['accepted', 'rejected', 'ignored', 'modified'].includes(data.decision)) {
      errors.push('Invalid decision value');
    }

    if (data.reasons?.primary && 
        !['too_expensive', 'not_priorities', 'already_doing', 'dont_understand', 
          'not_now', 'too_aggressive', 'not_confident', 'other'].includes(data.reasons.primary)) {
      errors.push('Invalid primary reason');
    }

    if (data.context?.responseTime && data.context.responseTime < 0) {
      errors.push('Invalid response time');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate preference updates
   */
  validatePreferenceUpdate(userId, updates) {
    const errors = [];

    if (!userId) {
      errors.push('User ID is required');
    }

    // Validate weight updates
    if (updates.weight !== undefined) {
      if (typeof updates.weight !== 'number' || updates.weight < 0 || updates.weight > 2) {
        errors.push('Weight must be between 0 and 2');
      }
    }

    // Validate frequency
    if (updates.frequency && !['low', 'medium', 'high', 'adaptive'].includes(updates.frequency)) {
      errors.push('Invalid frequency value');
    }

    // Validate risk tolerance
    if (updates.riskTolerance && !['low', 'medium', 'high'].includes(updates.riskTolerance)) {
      errors.push('Invalid risk tolerance');
    }

    // Validate min savings
    if (updates.minSavings !== undefined && 
        (typeof updates.minSavings !== 'number' || updates.minSavings < 0)) {
      errors.push('Invalid minimum savings amount');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate category preference
   */
  validateCategoryPreference(data) {
    const errors = [];

    if (!data.categoryId) {
      errors.push('Category ID is required');
    }

    if (data.weight !== undefined && (data.weight < 0 || data.weight > 2)) {
      errors.push('Weight must be between 0 and 2');
    }

    if (data.sensitivity !== undefined) {
      if (data.sensitivity.priceSensitivity !== undefined && 
          (data.sensitivity.priceSensitivity < 0 || data.sensitivity.priceSensitivity > 1)) {
        errors.push('Price sensitivity must be between 0 and 1');
      }
      
      if (data.sensitivity.changeTolerance !== undefined && 
          (data.sensitivity.changeTolerance < 0 || data.sensitivity.changeTolerance > 100)) {
        errors.push('Change tolerance must be between 0 and 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate learning configuration
   */
  validateLearningConfig(config) {
    const errors = [];

    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
      errors.push('Enabled must be a boolean');
    }

    if (config.minDataPoints !== undefined && 
        (typeof config.minDataPoints !== 'number' || config.minDataPoints < 1)) {
      errors.push('Invalid minimum data points');
    }

    if (config.adaptationRate !== undefined && 
        (config.adaptationRate < 0 || config.adaptationRate > 1)) {
      errors.push('Adaptation rate must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if user has enough data for learning
   */
  hasEnoughData(userPrefs, minInteractions = 10) {
    const total = userPrefs?.suggestionPreferences?.global?.totalSuggestionsShown || 0;
    return total >= minInteractions;
  }

  /**
   * Validate weight adjustment
   */
  validateWeightAdjustment(currentWeight, adjustment) {
    const newWeight = currentWeight * adjustment.factor;
    
    if (newWeight < 0 || newWeight > 2) {
      return {
        valid: false,
        reason: 'Adjustment would put weight outside valid range',
        currentWeight,
        proposedWeight: newWeight
      };
    }

    return {
      valid: true,
      newWeight
    };
  }

  /**
   * Validate decision pattern
   */
  validateDecisionPattern(patterns) {
    // Check for sufficient data
    if (patterns.length < 3) {
      return {
        valid: false,
        reason: 'Insufficient data for pattern detection'
      };
    }

    // Check for consistency
    const decisions = patterns.map(p => p.decision);
    const uniqueDecisions = new Set(decisions);
    
    if (uniqueDecisions.size === 1) {
      return {
        valid: true,
        pattern: 'consistent',
        value: decisions[0]
      };
    }

    if (decisions.slice(-3).every(d => d === decisions[decisions.length - 1])) {
      return {
        valid: true,
        pattern: 'recently_consistent',
        value: decisions[decisions.length - 1]
      };
    }

    return {
      valid: true,
      pattern: 'mixed'
    };
  }

  /**
   * Validate learning rate
   */
  validateLearningRate(rate) {
    if (rate < 0 || rate > 1) {
      return {
        valid: false,
        message: 'Learning rate must be between 0 and 1'
      };
    }

    if (rate > 0.5) {
      return {
        valid: true,
        warning: 'High learning rate may cause rapid preference changes'
      };
    }

    return { valid: true };
  }
}

module.exports = new LearningValidator();