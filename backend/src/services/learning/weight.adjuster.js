const UserPreference = require('../../models/UserPreference');
const CategoryPreference = require('../../models/CategoryPreference');
const SuggestionFeedback = require('../../models/SuggestionFeedback');

class WeightAdjuster {
  /**
   * Adjust all weights for a user based on feedback
   */
  async adjustWeights(userId) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return;

    const adjustments = [];

    // Adjust type weights
    for (const [type, prefs] of Object.entries(userPrefs.suggestionPreferences.types)) {
      const adjustment = await this.adjustTypeWeight(userId, type, prefs);
      if (adjustment) {
        prefs.weight = adjustment.newWeight;
        adjustments.push(adjustment);
      }
    }

    // Adjust global frequency
    await this.adjustFrequency(userPrefs);

    // Adjust category weights
    await this.adjustCategoryWeights(userId);

    await userPrefs.save();

    return adjustments;
  }

  /**
   * Adjust weight for a specific suggestion type
   */
  async adjustTypeWeight(userId, type, prefs) {
    const totalInteractions = prefs.acceptedCount + prefs.rejectedCount;
    if (totalInteractions < 5) return null; // Need minimum data

    const acceptanceRate = prefs.acceptedCount / totalInteractions;
    const recencyFactor = this.calculateRecencyFactor(prefs.lastAction);
    
    let newWeight = prefs.weight;

    // Adjust based on acceptance rate
    if (acceptanceRate > 0.7) {
      newWeight = Math.min(2, prefs.weight + 0.2 * recencyFactor);
    } else if (acceptanceRate < 0.3) {
      newWeight = Math.max(0, prefs.weight - 0.3 * recencyFactor);
    }

    // Adjust based on recency of interactions
    if (prefs.lastAction) {
      const daysSince = (Date.now() - prefs.lastAction) / (1000 * 60 * 60 * 24);
      if (daysSince > 30 && acceptanceRate < 0.5) {
        newWeight = Math.max(0, newWeight - 0.1);
      }
    }

    // Apply cooldown if recently rejected
    if (prefs.lastAction && prefs.rejectedCount > prefs.acceptedCount) {
      const daysSinceLastRejection = this.getDaysSinceLastRejection(userId, type);
      if (daysSinceLastRejection < prefs.cooldown) {
        newWeight *= 0.5; // Reduce weight during cooldown
      }
    }

    return {
      type,
      oldWeight: prefs.weight,
      newWeight,
      acceptanceRate,
      recencyFactor
    };
  }

  /**
   * Adjust suggestion frequency based on user engagement
   */
  async adjustFrequency(userPrefs) {
    const global = userPrefs.suggestionPreferences.global;
    const totalSuggestions = global.totalSuggestionsShown;
    
    if (totalSuggestions < 10) return;

    const acceptanceRate = global.acceptanceRate / 100; // Convert from percentage

    // Adaptive frequency based on engagement
    if (acceptanceRate > 0.6) {
      // High engagement - increase frequency
      global.suggestionFrequency = 'high';
    } else if (acceptanceRate > 0.3) {
      // Medium engagement - medium frequency
      global.suggestionFrequency = 'medium';
    } else {
      // Low engagement - low frequency
      global.suggestionFrequency = 'low';
    }

    // Adjust based on time since last active
    if (global.lastActive) {
      const daysSince = (Date.now() - global.lastActive) / (1000 * 60 * 60 * 24);
      if (daysSince > 14 && global.suggestionFrequency !== 'low') {
        global.suggestionFrequency = 'low'; // Reduce frequency for inactive users
      }
    }
  }

  /**
   * Adjust category weights
   */
  async adjustCategoryWeights(userId) {
    const categories = await CategoryPreference.find({ userId });

    for (const cat of categories) {
      const totalInteractions = cat.metrics.acceptedCount + cat.metrics.rejectedCount;
      
      if (totalInteractions > 3) {
        const acceptanceRate = cat.metrics.acceptedCount / totalInteractions;
        
        // Adjust weight based on acceptance
        if (acceptanceRate > 0.6) {
          cat.metrics.weight = Math.min(2, cat.metrics.weight + 0.1);
        } else if (acceptanceRate < 0.3) {
          cat.metrics.weight = Math.max(0, cat.metrics.weight - 0.15);
        }

        // Adjust based on spending patterns
        if (cat.spending.volatility > 0.5) {
          // High volatility - reduce weight for suggestions
          cat.metrics.weight *= 0.8;
        }

        await cat.save();
      }
    }
  }

  /**
   * Get days since last rejection for a type
   */
  async getDaysSinceLastRejection(userId, type) {
    const lastRejection = await SuggestionFeedback.findOne({
      userId,
      type,
      decision: 'rejected'
    }).sort({ createdAt: -1 });

    if (!lastRejection) return Infinity;

    return (Date.now() - lastRejection.createdAt) / (1000 * 60 * 60 * 24);
  }

  /**
   * Calculate recency factor (0-1)
   */
  calculateRecencyFactor(lastAction) {
    if (!lastAction) return 1;
    
    const daysSince = (Date.now() - lastAction) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - (daysSince / 90));
  }

  /**
   * Get adjusted weight for a suggestion
   */
  async getAdjustedWeight(userId, suggestion) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return 1.0;

    let weight = 1.0;

    // Type weight
    const typeWeight = userPrefs.suggestionPreferences.types[suggestion.type]?.weight;
    if (typeWeight !== undefined) {
      weight *= typeWeight;
    }

    // Category weight if applicable
    if (suggestion.proposedChanges?.categoryId) {
      const catPref = await CategoryPreference.findOne({
        userId,
        categoryId: suggestion.proposedChanges.categoryId
      });
      if (catPref) {
        weight *= catPref.metrics.weight;
      }
    }

    // Impact weight
    if (suggestion.estimatedImpact?.amount) {
      const minSavings = userPrefs.impactPreferences.minSavingsAmount;
      if (suggestion.estimatedImpact.amount < minSavings) {
        weight *= 0.5; // Reduce weight for low-impact suggestions
      }
    }

    // Risk weight
    if (suggestion.metadata?.riskLevel) {
      const maxRisk = userPrefs.impactPreferences.maxRiskTolerance;
      if (this.isRiskTooHigh(suggestion.metadata.riskLevel, maxRisk)) {
        weight *= 0.3;
      }
    }

    return Math.min(2, Math.max(0, weight));
  }

  /**
   * Check if risk level exceeds tolerance
   */
  isRiskTooHigh(riskLevel, maxTolerance) {
    const riskValues = { low: 1, medium: 2, high: 3 };
    const toleranceValues = { low: 1, medium: 2, high: 3 };

    return riskValues[riskLevel] > toleranceValues[maxTolerance];
  }

  /**
   * Reset weights to default
   */
  async resetWeights(userId) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return;

    // Reset type weights
    Object.values(userPrefs.suggestionPreferences.types).forEach(pref => {
      pref.weight = 1.0;
    });

    // Reset category weights
    await CategoryPreference.updateMany(
      { userId },
      { $set: { 'metrics.weight': 1.0 } }
    );

    userPrefs.suggestionPreferences.global.suggestionFrequency = 'adaptive';
    await userPrefs.save();

    return { message: 'Weights reset to default' };
  }
}

module.exports = new WeightAdjuster();