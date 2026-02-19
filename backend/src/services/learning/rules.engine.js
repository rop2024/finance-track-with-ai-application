const UserPreference = require('../../models/UserPreference');
const CategoryPreference = require('../../models/CategoryPreference');
const SuggestionFeedback = require('../../models/SuggestionFeedback');
const WeightAdjuster = require('./weight.adjuster');

class RulesEngine {
  constructor() {
    this.rules = [
      {
        name: 'repeatedRejectionRule',
        condition: (context) => context.rejectionRate > 0.7 && context.totalInteractions > 5,
        action: async (userId, context) => {
          await WeightAdjuster.adjustWeights(userId);
          return {
            action: 'reduce_weight',
            reason: 'Repeated rejections detected',
            factor: 0.5
          };
        }
      },
      {
        name: 'highAcceptanceRule',
        condition: (context) => context.acceptanceRate > 0.8 && context.totalInteractions > 5,
        action: async (userId, context) => {
          return {
            action: 'increase_frequency',
            reason: 'High acceptance rate',
            factor: 1.5
          };
        }
      },
      {
        name: 'lowEngagementRule',
        condition: (context) => context.daysSinceLastAction > 14 && context.totalInteractions < 10,
        action: async (userId, context) => {
          return {
            action: 'reduce_frequency',
            reason: 'Low user engagement',
            factor: 0.3
          };
        }
      },
      {
        name: 'categorySaturationRule',
        condition: (context) => context.categorySuggestions > 10 && context.categoryAcceptance < 0.3,
        action: async (userId, context) => {
          await CategoryPreference.updateOne(
            { userId, categoryId: context.categoryId },
            { $mul: { 'metrics.weight': 0.5 } }
          );
          return {
            action: 'reduce_category_weight',
            reason: 'Low acceptance for category',
            category: context.categoryId
          };
        }
      },
      {
        name: 'timePatternRule',
        condition: (context) => context.optimalHour && context.currentHour !== context.optimalHour,
        action: async (userId, context) => {
          return {
            action: 'delay_suggestion',
            reason: 'Not optimal time',
            suggestedHour: context.optimalHour
          };
        }
      },
      {
        name: 'impactThresholdRule',
        condition: (context) => context.estimatedImpact < context.minSavingsThreshold,
        action: async (userId, context) => {
          return {
            action: 'filter_low_impact',
            reason: 'Below savings threshold',
            threshold: context.minSavingsThreshold
          };
        }
      },
      {
        name: 'riskToleranceRule',
        condition: (context) => context.riskLevel > context.maxRiskTolerance,
        action: async (userId, context) => {
          return {
            action: 'filter_high_risk',
            reason: 'Exceeds risk tolerance',
            maxRisk: context.maxRiskTolerance
          };
        }
      },
      {
        name: 'suggestionTypeFatigueRule',
        condition: (context) => context.typeSuggestionsThisWeek > 3 && context.typeRejectionRate > 0.6,
        action: async (userId, context) => {
          return {
            action: 'pause_type',
            reason: 'User fatigue detected',
            type: context.type,
            duration: '7 days'
          };
        }
      }
    ];
  }

  /**
   * Evaluate all rules for a suggestion
   */
  async evaluateSuggestion(userId, suggestion) {
    const context = await this.buildContext(userId, suggestion);
    const applicableRules = [];
    const actions = [];

    for (const rule of this.rules) {
      try {
        if (rule.condition(context)) {
          applicableRules.push(rule.name);
          const action = await rule.action(userId, context);
          actions.push(action);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }

    return {
      shouldShow: this.determineShouldShow(actions),
      applicableRules,
      actions,
      context,
      finalWeight: this.calculateFinalWeight(context, actions)
    };
  }

  /**
   * Build context for rule evaluation
   */
  async buildContext(userId, suggestion) {
    const userPrefs = await UserPreference.findOne({ userId });
    const categoryPref = suggestion.proposedChanges?.categoryId 
      ? await CategoryPreference.findOne({ 
          userId, 
          categoryId: suggestion.proposedChanges.categoryId 
        })
      : null;

    const typeStats = userPrefs?.suggestionPreferences.types[suggestion.type] || {};
    const globalStats = userPrefs?.suggestionPreferences.global || {};

    // Calculate recent stats
    const recentFeedbacks = await SuggestionFeedback.find({
      userId,
      type: suggestion.type,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const typeSuggestionsThisWeek = await SuggestionFeedback.countDocuments({
      userId,
      type: suggestion.type,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const typeRejections = recentFeedbacks.filter(f => f.decision === 'rejected').length;
    const typeAcceptances = recentFeedbacks.filter(f => f.decision === 'accepted').length;
    const totalTypeInteractions = typeRejections + typeAcceptances;

    return {
      // User stats
      userId,
      totalInteractions: globalStats.totalSuggestionsShown || 0,
      acceptanceRate: globalStats.acceptanceRate || 0,
      daysSinceLastAction: this.getDaysSince(globalStats.lastActive),
      
      // Type stats
      type: suggestion.type,
      typeStats,
      typeSuggestionsThisWeek,
      typeRejectionRate: totalTypeInteractions > 0 ? typeRejections / totalTypeInteractions : 0,
      typeAcceptanceRate: totalTypeInteractions > 0 ? typeAcceptances / totalTypeInteractions : 0,
      
      // Category stats
      categoryId: suggestion.proposedChanges?.categoryId,
      categorySuggestions: categoryPref?.metrics.acceptedCount + categoryPref?.metrics.rejectedCount || 0,
      categoryAcceptance: categoryPref ? 
        categoryPref.metrics.acceptedCount / 
        (categoryPref.metrics.acceptedCount + categoryPref.metrics.rejectedCount) : null,
      
      // Suggestion details
      estimatedImpact: suggestion.estimatedImpact?.amount || 0,
      riskLevel: suggestion.metadata?.riskLevel || 'low',
      
      // Preferences
      minSavingsThreshold: userPrefs?.impactPreferences.minSavingsAmount || 10,
      maxRiskTolerance: userPrefs?.impactPreferences.maxRiskTolerance || 'medium',
      optimalHour: userPrefs?.timePreferences.bestTimeToSuggest,
      currentHour: new Date().getHours(),
      
      // Time context
      isWeekend: [0, 6].includes(new Date().getDay()),
      timeOfDay: this.getTimeOfDay(),
      
      // Computed
      rejectionRate: this.calculateRejectionRate(typeStats),
      needsLearning: totalTypeInteractions < 3
    };
  }

  /**
   * Determine if suggestion should be shown based on actions
   */
  determineShouldShow(actions) {
    // If any action explicitly filters or blocks, don't show
    const blockingActions = ['filter_low_impact', 'filter_high_risk', 'pause_type'];
    
    for (const action of actions) {
      if (blockingActions.includes(action.action)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate final weight after all actions
   */
  calculateFinalWeight(context, actions) {
    let weight = 1.0;

    for (const action of actions) {
      if (action.factor) {
        weight *= action.factor;
      }
    }

    // Cap at reasonable bounds
    return Math.max(0.1, Math.min(2.0, weight));
  }

  /**
   * Calculate rejection rate from stats
   */
  calculateRejectionRate(stats) {
    const total = (stats.acceptedCount || 0) + (stats.rejectedCount || 0);
    if (total === 0) return 0;
    return (stats.rejectedCount || 0) / total;
  }

  /**
   * Get days since last action
   */
  getDaysSince(date) {
    if (!date) return Infinity;
    return (Date.now() - date) / (1000 * 60 * 60 * 24);
  }

  /**
   * Get time of day category
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Get learning insights
   */
  async getLearningInsights(userId) {
    const [userPrefs, recentDecisions] = await Promise.all([
      UserPreference.findOne({ userId }),
      SuggestionFeedback.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
    ]);

    if (!userPrefs) return [];

    const insights = [];

    // Analyze acceptance trends
    const decisions = recentDecisions.map(d => d.decision);
    const recentAcceptance = decisions.filter(d => d === 'accepted').length / decisions.length;
    
    if (recentAcceptance > 0.7) {
      insights.push({
        type: 'positive_trend',
        message: 'You\'ve been accepting many suggestions lately',
        suggestion: 'We\'ll continue showing similar recommendations'
      });
    } else if (recentAcceptance < 0.3) {
      insights.push({
        type: 'negative_trend',
        message: 'You\'ve been rejecting many suggestions',
        suggestion: 'We\'ll adjust to show more relevant recommendations'
      });
    }

    // Analyze category patterns
    const categoryPatterns = await this.analyzeCategoryPatterns(userId);
    if (categoryPatterns.length > 0) {
      insights.push({
        type: 'category_pattern',
        message: `You frequently ${categoryPatterns[0].action} suggestions about ${categoryPatterns[0].category}`,
        suggestion: 'We\'ve adjusted preferences for this category'
      });
    }

    // Analyze time patterns
    const timePatterns = await this.analyzeTimePatterns(userId);
    if (timePatterns.bestTime) {
      insights.push({
        type: 'time_pattern',
        message: `You're most responsive in the ${timePatterns.bestTime}`,
        suggestion: 'We\'ll show suggestions during your preferred time'
      });
    }

    return insights;
  }

  /**
   * Analyze category patterns
   */
  async analyzeCategoryPatterns(userId) {
    const patterns = await SuggestionFeedback.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          accepted: {
            $sum: { $cond: [{ $eq: ['$decision', 'accepted'] }, 1, 0] }
          }
        }
      },
      {
        $match: { total: { $gte: 5 } }
      },
      {
        $project: {
          type: '$_id',
          acceptanceRate: { $divide: ['$accepted', '$total'] },
          total: 1
        }
      },
      { $sort: { acceptanceRate: -1 } }
    ]);

    return patterns.map(p => ({
      category: p.type,
      action: p.acceptanceRate > 0.6 ? 'accept' : 'reject',
      rate: p.acceptanceRate
    }));
  }

  /**
   * Analyze time patterns
   */
  async analyzeTimePatterns(userId) {
    const hourStats = {};
    
    const feedbacks = await SuggestionFeedback.find({
      userId,
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    });

    feedbacks.forEach(f => {
      const hour = f.createdAt.getHours();
      if (!hourStats[hour]) {
        hourStats[hour] = { total: 0, accepted: 0 };
      }
      hourStats[hour].total++;
      if (f.decision === 'accepted') {
        hourStats[hour].accepted++;
      }
    });

    let bestHour = null;
    let bestRate = 0;

    Object.entries(hourStats).forEach(([hour, stats]) => {
      if (stats.total >= 5) {
        const rate = stats.accepted / stats.total;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
      }
    });

    return {
      bestTime: bestHour ? this.hourToPeriod(bestHour) : null,
      stats: hourStats
    };
  }

  /**
   * Convert hour to time period
   */
  hourToPeriod(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }
}

module.exports = new RulesEngine();