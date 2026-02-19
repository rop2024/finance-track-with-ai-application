const UserPreference = require('../../models/UserPreference');
const CategoryPreference = require('../../models/CategoryPreference');
const SuggestionFeedback = require('../../models/SuggestionFeedback');
const WeightAdjuster = require('./weight.adjuster');

class PreferenceManager {
  /**
   * Get user's complete preference profile
   */
  async getUserProfile(userId) {
    const [userPrefs, categoryPrefs, feedback] = await Promise.all([
      UserPreference.findOne({ userId }),
      CategoryPreference.find({ userId }),
      SuggestionFeedback.find({ userId })
        .sort({ createdAt: -1 })
        .limit(100)
    ]);

    return {
      user: userPrefs || await this.initializePreferences(userId),
      categories: categoryPrefs,
      recentFeedback: feedback,
      summary: this.generateProfileSummary(userPrefs, categoryPrefs, feedback)
    };
  }

  /**
   * Initialize preferences for new user
   */
  async initializePreferences(userId) {
    const userPrefs = new UserPreference({ userId });
    await userPrefs.save();
    return userPrefs;
  }

  /**
   * Update specific preference
   */
  async updatePreference(userId, path, value) {
    const update = {};
    update[path] = value;

    const userPrefs = await UserPreference.findOneAndUpdate(
      { userId },
      { $set: update, 'metadata.lastUpdated': new Date() },
      { new: true, upsert: true }
    );

    return userPrefs;
  }

  /**
   * Get category preferences
   */
  async getCategoryPreferences(userId) {
    return await CategoryPreference.find({ userId })
      .sort({ 'metrics.weight': -1 })
      .populate('categoryId');
  }

  /**
   * Update category preference
   */
  async updateCategoryPreference(userId, categoryId, updates) {
    let catPref = await CategoryPreference.findOne({ userId, categoryId });
    
    if (!catPref) {
      catPref = new CategoryPreference({ userId, categoryId });
    }

    Object.assign(catPref, updates);
    await catPref.save();

    return catPref;
  }

  /**
   * Get suggestion preferences
   */
  async getSuggestionPreferences(userId) {
    const userPrefs = await UserPreference.findOne({ userId });
    return userPrefs?.suggestionPreferences || {};
  }

  /**
   * Update suggestion type preference
   */
  async updateSuggestionTypePreference(userId, type, updates) {
    const userPrefs = await UserPreference.findOneAndUpdate(
      { userId },
      {
        $set: {
          [`suggestionPreferences.types.${type}`]: {
            ...updates,
            lastAction: new Date()
          }
        }
      },
      { new: true, upsert: true }
    );

    return userPrefs.suggestionPreferences.types[type];
  }

  /**
   * Get impact preferences
   */
  async getImpactPreferences(userId) {
    const userPrefs = await UserPreference.findOne({ userId });
    return userPrefs?.impactPreferences || {};
  }

  /**
   * Update impact preferences
   */
  async updateImpactPreferences(userId, updates) {
    const userPrefs = await UserPreference.findOneAndUpdate(
      { userId },
      {
        $set: {
          impactPreferences: updates,
          'metadata.lastUpdated': new Date()
        }
      },
      { new: true, upsert: true }
    );

    return userPrefs.impactPreferences;
  }

  /**
   * Get time preferences
   */
  async getTimePreferences(userId) {
    const userPrefs = await UserPreference.findOne({ userId });
    return userPrefs?.timePreferences || {};
  }

  /**
   * Update time preferences
   */
  async updateTimePreferences(userId, updates) {
    const userPrefs = await UserPreference.findOneAndUpdate(
      { userId },
      {
        $set: {
          timePreferences: updates,
          'metadata.lastUpdated': new Date()
        }
      },
      { new: true, upsert: true }
    );

    return userPrefs.timePreferences;
  }

  /**
   * Generate profile summary
   */
  generateProfileSummary(userPrefs, categoryPrefs, feedback) {
    if (!userPrefs) return {};

    const global = userPrefs.suggestionPreferences.global;
    const types = userPrefs.suggestionPreferences.types;

    // Calculate top accepted types
    const typePerformance = Object.entries(types).map(([type, data]) => ({
      type,
      acceptanceRate: data.acceptedCount + data.rejectedCount > 0
        ? data.acceptedCount / (data.acceptedCount + data.rejectedCount)
        : 0,
      total: data.acceptedCount + data.rejectedCount,
      weight: data.weight
    }));

    const topAccepted = typePerformance
      .filter(t => t.total >= 3)
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate)
      .slice(0, 3);

    // Get top categories by weight
    const topCategories = categoryPrefs
      .filter(c => c.metrics.acceptedCount + c.metrics.rejectedCount >= 3)
      .sort((a, b) => b.metrics.weight - a.metrics.weight)
      .slice(0, 5)
      .map(c => ({
        category: c.categoryId,
        weight: c.metrics.weight,
        acceptanceRate: c.metrics.acceptedCount / 
          (c.metrics.acceptedCount + c.metrics.rejectedCount)
      }));

    return {
      engagement: {
        totalSuggestions: global.totalSuggestionsShown,
        acceptanceRate: global.acceptanceRate,
        frequency: global.suggestionFrequency
      },
      topPerformingTypes: topAccepted,
      topCategories,
      preferences: {
        riskTolerance: userPrefs.impactPreferences.maxRiskTolerance,
        minSavings: userPrefs.impactPreferences.minSavingsAmount,
        bestTime: userPrefs.timePreferences.bestTimeToSuggest
      },
      learning: {
        enabled: userPrefs.metadata.learningEnabled,
        version: userPrefs.metadata.version,
        dataPoints: feedback.length
      }
    };
  }

  /**
   * Reset all preferences to default
   */
  async resetPreferences(userId) {
    await UserPreference.findOneAndDelete({ userId });
    await CategoryPreference.deleteMany({ userId });
    
    // Reinitialize with defaults
    const newPrefs = await this.initializePreferences(userId);
    
    return newPrefs;
  }

  /**
   * Export user preferences for backup
   */
  async exportPreferences(userId) {
    const [userPrefs, categoryPrefs, feedback] = await Promise.all([
      UserPreference.findOne({ userId }),
      CategoryPreference.find({ userId }),
      SuggestionFeedback.find({ userId })
    ]);

    return {
      exportedAt: new Date(),
      userId,
      userPreferences: userPrefs,
      categoryPreferences: categoryPrefs,
      feedback: feedback,
      summary: this.generateProfileSummary(userPrefs, categoryPrefs, feedback)
    };
  }

  /**
   * Import user preferences
   */
  async importPreferences(userId, data) {
    // Validate data structure
    if (!data.userPreferences) {
      throw new Error('Invalid preference data');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Clear existing
      await UserPreference.deleteOne({ userId }).session(session);
      await CategoryPreference.deleteMany({ userId }).session(session);
      await SuggestionFeedback.deleteMany({ userId }).session(session);

      // Import new data
      data.userPreferences.userId = userId;
      await UserPreference.create([data.userPreferences], { session });

      if (data.categoryPreferences) {
        data.categoryPreferences.forEach(c => c.userId = userId);
        await CategoryPreference.create(data.categoryPreferences, { session });
      }

      if (data.feedback) {
        data.feedback.forEach(f => f.userId = userId);
        await SuggestionFeedback.create(data.feedback, { session });
      }

      await session.commitTransaction();

      return await this.getUserProfile(userId);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new PreferenceManager();