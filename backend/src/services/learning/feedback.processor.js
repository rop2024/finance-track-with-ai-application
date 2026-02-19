const SuggestionFeedback = require('../../models/SuggestionFeedback');
const UserPreference = require('../../models/UserPreference');
const CategoryPreference = require('../../models/CategoryPreference');
const WeightAdjuster = require('./weight.adjuster');
const AuditUtils = require('../../utils/audit.utils');

class FeedbackProcessor {
  /**
   * Process user decision on suggestion
   */
  async processDecision(suggestionId, userId, decision, context = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get the suggestion
      const suggestion = await PendingSuggestion.findById(suggestionId)
        .session(session);

      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      // Create feedback record
      const feedback = new SuggestionFeedback({
        userId,
        suggestionId: suggestion._id,
        insightId: suggestion.insightId,
        type: suggestion.type,
        decision,
        context: {
          suggestedAt: suggestion.createdAt,
          respondedAt: new Date(),
          responseTime: context.responseTime,
          viewedDuration: context.viewedDuration,
          deviceType: context.deviceType
        },
        reasons: context.reasons || {},
        modifications: context.modifications,
        outcome: {
          applied: decision === 'accepted'
        }
      });

      await feedback.save({ session });

      // Update user preferences
      await this.updateUserPreferences(userId, suggestion, decision, context, session);

      // Update category preferences if applicable
      if (suggestion.proposedChanges?.categoryId) {
        await this.updateCategoryPreferences(
          userId,
          suggestion.proposedChanges.categoryId,
          suggestion,
          decision,
          session
        );
      }

      // Log the decision
      await AuditUtils.logAction({
        userId,
        action: `suggestion_${decision}`,
        resourceId: suggestionId,
        details: {
          type: suggestion.type,
          decision,
          reasons: context.reasons
        }
      }, session);

      await session.commitTransaction();

      // Trigger weight adjustments
      await WeightAdjuster.adjustWeights(userId);

      return feedback;

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update user preferences based on decision
   */
  async updateUserPreferences(userId, suggestion, decision, context, session) {
    let userPrefs = await UserPreference.findOne({ userId }).session(session);
    
    if (!userPrefs) {
      userPrefs = new UserPreference({ userId });
    }

    // Update type-specific counters
    const typePref = userPrefs.suggestionPreferences.types[suggestion.type];
    if (typePref) {
      if (decision === 'accepted') {
        typePref.acceptedCount++;
        userPrefs.suggestionPreferences.global.totalAccepted++;
      } else if (decision === 'rejected') {
        typePref.rejectedCount++;
        userPrefs.suggestionPreferences.global.totalRejected++;
      }
      
      typePref.lastAction = new Date();
      
      // Adjust weight based on decision
      if (decision === 'accepted') {
        typePref.weight = Math.min(2, typePref.weight + 0.1);
      } else if (decision === 'rejected') {
        typePref.weight = Math.max(0, typePref.weight - 0.15);
      }
    }

    // Update global metrics
    userPrefs.suggestionPreferences.global.lastActive = new Date();
    userPrefs.updateAcceptanceRate();

    // Update time preferences
    await this.updateTimePreferences(userPrefs, context, session);

    // Update impact preferences
    if (suggestion.estimatedImpact?.amount) {
      this.updateImpactPreferences(userPrefs, suggestion, decision);
    }

    await userPrefs.save({ session });
  }

  /**
   * Update category-specific preferences
   */
  async updateCategoryPreferences(userId, categoryId, suggestion, decision, session) {
    let catPref = await CategoryPreference.findOne({
      userId,
      categoryId
    }).session(session);

    if (!catPref) {
      catPref = new CategoryPreference({
        userId,
        categoryId
      });
    }

    // Update metrics
    if (decision === 'accepted') {
      catPref.metrics.acceptedCount++;
      catPref.metrics.weight = Math.min(2, catPref.metrics.weight + 0.1);
    } else if (decision === 'rejected') {
      catPref.metrics.rejectedCount++;
      catPref.metrics.weight = Math.max(0, catPref.metrics.weight - 0.1);
    }

    catPref.metrics.lastInteraction = new Date();
    catPref.metrics.suggestionRelevance = this.calculateRelevance(catPref);

    // Store feedback
    catPref.feedback.push({
      suggestionId: suggestion._id,
      decision,
      reason: context.reasons?.primary,
      impact: suggestion.estimatedImpact?.amount,
      timestamp: new Date()
    });

    // Update sensitivity based on decision patterns
    await this.updateCategorySensitivity(catPref, suggestion, decision);

    await catPref.save({ session });
  }

  /**
   * Update time-based preferences
   */
  async updateTimePreferences(userPrefs, context, session) {
    if (!context.respondedAt) return;

    const hour = new Date(context.respondedAt).getHours();
    
    // Update response time by hour
    const currentCount = userPrefs.timePreferences.responseTimeByHour.get(hour.toString()) || 0;
    userPrefs.timePreferences.responseTimeByHour.set(hour.toString(), currentCount + 1);

    // Find best time based on response patterns
    if (userPrefs.timePreferences.bestTimeToSuggest === 'adaptive') {
      const bestHour = this.findBestResponseHour(userPrefs);
      if (bestHour !== null) {
        if (bestHour >= 5 && bestHour < 12) {
          userPrefs.timePreferences.bestTimeToSuggest = 'morning';
        } else if (bestHour >= 12 && bestHour < 17) {
          userPrefs.timePreferences.bestTimeToSuggest = 'afternoon';
        } else {
          userPrefs.timePreferences.bestTimeToSuggest = 'evening';
        }
      }
    }
  }

  /**
   * Update category sensitivity based on decisions
   */
  async updateCategorySensitivity(catPref, suggestion, decision) {
    const impactAmount = Math.abs(suggestion.estimatedImpact?.amount || 0);
    const avgSpend = catPref.spending.averageMonthly || 1;

    // Adjust price sensitivity based on decision patterns
    if (decision === 'rejected' && impactAmount > avgSpend * 0.1) {
      // User rejected a significant change - they might be price sensitive
      catPref.sensitivity.priceSensitivity = Math.min(1, 
        catPref.sensitivity.priceSensitivity + 0.1);
    } else if (decision === 'accepted' && impactAmount > avgSpend * 0.2) {
      // User accepted a large change - they might be less price sensitive
      catPref.sensitivity.priceSensitivity = Math.max(0, 
        catPref.sensitivity.priceSensitivity - 0.05);
    }

    // Update change tolerance based on acceptance patterns
    const recentDecisions = catPref.feedback.slice(-5);
    const acceptanceRate = recentDecisions.filter(f => f.decision === 'accepted').length / 
                          recentDecisions.length;

    if (acceptanceRate > 0.7) {
      catPref.sensitivity.changeTolerance = Math.min(100, 
        catPref.sensitivity.changeTolerance + 5);
    } else if (acceptanceRate < 0.3) {
      catPref.sensitivity.changeTolerance = Math.max(0, 
        catPref.sensitivity.changeTolerance - 5);
    }
  }

  /**
   * Update impact preferences based on user behavior
   */
  updateImpactPreferences(userPrefs, suggestion, decision) {
    const impactAmount = suggestion.estimatedImpact?.amount || 0;

    if (decision === 'accepted' && impactAmount > 0) {
      // User accepted a suggestion with impact - adjust min savings if needed
      if (userPrefs.impactPreferences.minSavingsAmount < impactAmount * 0.5) {
        userPrefs.impactPreferences.minSavingsAmount = impactAmount * 0.5;
      }
    } else if (decision === 'rejected' && impactAmount < userPrefs.impactPreferences.minSavingsAmount) {
      // User rejected small-impact suggestions - they might want higher impact
      userPrefs.impactPreferences.minSavingsAmount = Math.min(
        userPrefs.impactPreferences.minSavingsAmount * 1.2,
        impactAmount
      );
    }

    // Update risk tolerance based on decision patterns
    if (suggestion.metadata?.riskLevel) {
      const riskLevel = suggestion.metadata.riskLevel;
      if (decision === 'accepted') {
        // User accepted this risk level
        if (riskLevel === 'high' && userPrefs.impactPreferences.maxRiskTolerance === 'medium') {
          userPrefs.impactPreferences.maxRiskTolerance = 'high';
        }
      } else if (decision === 'rejected' && riskLevel === 'high') {
        // User rejected high risk - they might prefer lower risk
        userPrefs.impactPreferences.maxRiskTolerance = 'low';
      }
    }
  }

  /**
   * Calculate category relevance score
   */
  calculateRelevance(catPref) {
    const totalInteractions = catPref.metrics.acceptedCount + catPref.metrics.rejectedCount;
    if (totalInteractions === 0) return 1.0;

    const acceptanceRate = catPref.metrics.acceptedCount / totalInteractions;
    const recency = this.calculateRecencyFactor(catPref.metrics.lastInteraction);
    
    // Weighted combination
    return (acceptanceRate * 0.7 + recency * 0.3);
  }

  /**
   * Calculate recency factor (0-1)
   */
  calculateRecencyFactor(lastInteraction) {
    if (!lastInteraction) return 0.5;
    
    const daysSince = (Date.now() - lastInteraction) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - (daysSince / 90)); // Decay over 90 days
  }

  /**
   * Find best response hour from history
   */
  findBestResponseHour(userPrefs) {
    const hourCounts = Array.from(userPrefs.timePreferences.responseTimeByHour.entries());
    if (hourCounts.length === 0) return null;

    return hourCounts.reduce((best, current) => {
      return current[1] > best[1] ? current : best;
    })[0];
  }

  /**
   * Get decision patterns for user
   */
  async getDecisionPatterns(userId) {
    const patterns = await SuggestionFeedback.getPatterns(userId);
    
    const enriched = await Promise.all(patterns.map(async pattern => {
      const userPrefs = await UserPreference.findOne({ userId });
      const typeWeight = userPrefs?.suggestionPreferences.types[pattern._id]?.weight || 1.0;
      
      return {
        ...pattern,
        currentWeight: typeWeight,
        suggestedWeight: this.calculateSuggestedWeight(pattern, typeWeight)
      };
    }));

    return enriched;
  }

  /**
   * Calculate suggested weight based on patterns
   */
  calculateSuggestedWeight(pattern, currentWeight) {
    const acceptanceRate = pattern.accepted / pattern.total;
    const baseWeight = currentWeight;

    if (acceptanceRate > 0.7) {
      return Math.min(2, baseWeight * 1.2);
    } else if (acceptanceRate < 0.3) {
      return Math.max(0, baseWeight * 0.5);
    }

    return baseWeight;
  }
}

module.exports = new FeedbackProcessor();