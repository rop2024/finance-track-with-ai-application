const UserPreference = require('../../models/UserPreference');
const SuggestionFeedback = require('../../models/SuggestionFeedback');

class FrequencyController {
  /**
   * Determine if a suggestion should be shown now
   */
  async shouldShowSuggestion(userId, suggestionType) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return true;

    // Check if learning is disabled
    if (!userPrefs.metadata.learningEnabled) return true;

    const typePrefs = userPrefs.suggestionPreferences.types[suggestionType];
    const global = userPrefs.suggestionPreferences.global;

    // Check quiet hours
    if (this.isQuietHour(userPrefs)) {
      return false;
    }

    // Check cooldown
    if (typePrefs?.lastShown) {
      const daysSince = (Date.now() - typePrefs.lastShown) / (1000 * 60 * 60 * 24);
      if (daysSince < this.getCooldownPeriod(typePrefs)) {
        return false;
      }
    }

    // Check frequency cap
    const dailyCount = await this.getDailySuggestionCount(userId);
    const maxDaily = this.getMaxDailySuggestions(global.suggestionFrequency);
    
    if (dailyCount >= maxDaily) {
      return false;
    }

    // Check if type is blocked
    if (typePrefs?.weight <= 0.1) {
      return false;
    }

    return true;
  }

  /**
   * Get next allowed suggestion time
   */
  async getNextAllowedTime(userId, suggestionType) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return new Date();

    const typePrefs = userPrefs.suggestionPreferences.types[suggestionType];
    
    if (typePrefs?.lastShown) {
      const cooldownDays = this.getCooldownPeriod(typePrefs);
      const nextTime = new Date(typePrefs.lastShown);
      nextTime.setDate(nextTime.getDate() + cooldownDays);
      return nextTime;
    }

    return new Date(); // Can show now
  }

  /**
   * Record that a suggestion was shown
   */
  async recordSuggestionShown(userId, suggestionType) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return;

    const typePrefs = userPrefs.suggestionPreferences.types[suggestionType];
    if (typePrefs) {
      typePrefs.lastShown = new Date();
    }

    userPrefs.suggestionPreferences.global.totalSuggestionsShown++;
    await userPrefs.save();
  }

  /**
   * Check if current time is within quiet hours
   */
  isQuietHour(userPrefs) {
    if (!userPrefs.suggestionPreferences.global.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = userPrefs.suggestionPreferences.global.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = userPrefs.suggestionPreferences.global.quietHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Get cooldown period based on rejection history
   */
  getCooldownPeriod(typePrefs) {
    let baseCooldown = typePrefs.cooldown;

    // Increase cooldown if frequently rejected
    const total = typePrefs.acceptedCount + typePrefs.rejectedCount;
    if (total > 5) {
      const rejectionRate = typePrefs.rejectedCount / total;
      if (rejectionRate > 0.7) {
        baseCooldown *= 2;
      } else if (rejectionRate > 0.5) {
        baseCooldown *= 1.5;
      }
    }

    // Decrease cooldown if frequently accepted
    if (total > 5) {
      const acceptanceRate = typePrefs.acceptedCount / total;
      if (acceptanceRate > 0.7) {
        baseCooldown *= 0.7;
      }
    }

    return Math.max(1, Math.min(60, Math.round(baseCooldown)));
  }

  /**
   * Get daily suggestion count for user
   */
  async getDailySuggestionCount(userId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return await SuggestionFeedback.countDocuments({
      userId,
      createdAt: { $gte: startOfDay }
    });
  }

  /**
   * Get maximum daily suggestions based on frequency setting
   */
  getMaxDailySuggestions(frequency) {
    const limits = {
      low: 2,
      medium: 5,
      high: 10,
      adaptive: 5
    };
    return limits[frequency] || 5;
  }

  /**
   * Get best time to suggest based on user patterns
   */
  getBestTimeToSuggest(userPrefs) {
    const hourPreference = userPrefs.timePreferences.bestTimeToSuggest;
    
    switch(hourPreference) {
      case 'morning':
        return { hour: 9, minute: 0 };
      case 'afternoon':
        return { hour: 14, minute: 0 };
      case 'evening':
        return { hour: 19, minute: 0 };
      default:
        // Adaptive - find most responsive hour
        const bestHour = this.findBestResponseHour(userPrefs);
        return bestHour ? { hour: bestHour, minute: 0 } : { hour: 12, minute: 0 };
    }
  }

  /**
   * Find most responsive hour from history
   */
  findBestResponseHour(userPrefs) {
    const hourMap = userPrefs.timePreferences.responseTimeByHour;
    if (!hourMap || hourMap.size === 0) return null;

    let bestHour = null;
    let maxResponses = 0;

    for (const [hour, count] of hourMap.entries()) {
      if (count > maxResponses) {
        maxResponses = count;
        bestHour = parseInt(hour);
      }
    }

    return bestHour;
  }

  /**
   * Get suggestion frequency recommendation
   */
  getFrequencyRecommendation(userPrefs) {
    const global = userPrefs.suggestionPreferences.global;
    const acceptanceRate = global.acceptanceRate;

    if (acceptanceRate > 70) {
      return {
        frequency: 'high',
        reason: 'You frequently accept suggestions',
        suggestions: 'Up to 10 suggestions per day'
      };
    } else if (acceptanceRate > 40) {
      return {
        frequency: 'medium',
        reason: 'You have moderate engagement',
        suggestions: 'Up to 5 suggestions per day'
      };
    } else if (acceptanceRate > 0) {
      return {
        frequency: 'low',
        reason: 'You prefer fewer suggestions',
        suggestions: 'Up to 2 suggestions per day'
      };
    } else {
      return {
        frequency: 'adaptive',
        reason: 'Learning your preferences',
        suggestions: 'Will adjust based on your feedback'
      };
    }
  }

  /**
   * Update quiet hours based on user activity
   */
  async updateQuietHours(userId) {
    const userPrefs = await UserPreference.findOne({ userId });
    if (!userPrefs) return;

    // Analyze response times to find quiet periods
    const hourMap = userPrefs.timePreferences.responseTimeByHour;
    if (hourMap.size < 50) return; // Need sufficient data

    // Find hours with zero or very few responses
    const quietHours = [];
    const totalResponses = Array.from(hourMap.values()).reduce((a, b) => a + b, 0);
    const avgResponses = totalResponses / 24;

    for (let hour = 0; hour < 24; hour++) {
      const responses = hourMap.get(hour.toString()) || 0;
      if (responses < avgResponses * 0.3) {
        quietHours.push(hour);
      }
    }

    // Find contiguous quiet periods
    const quietPeriods = this.findContiguousPeriods(quietHours);
    
    if (quietPeriods.length > 0) {
      // Set quiet hours to the longest quiet period
      const longest = quietPeriods.reduce((a, b) => 
        (b.end - b.start) > (a.end - a.start) ? b : a
      );

      userPrefs.suggestionPreferences.global.quietHours = {
        enabled: true,
        start: `${longest.start}:00`,
        end: `${longest.end}:00`
      };

      await userPrefs.save();
    }
  }

  /**
   * Find contiguous periods from hour list
   */
  findContiguousPeriods(hours) {
    if (hours.length === 0) return [];

    hours.sort((a, b) => a - b);
    const periods = [];
    let start = hours[0];
    let prev = hours[0];

    for (let i = 1; i < hours.length; i++) {
      if (hours[i] !== prev + 1) {
        periods.push({ start, end: prev });
        start = hours[i];
      }
      prev = hours[i];
    }
    periods.push({ start, end: prev });

    return periods;
  }
}

module.exports = new FrequencyController();