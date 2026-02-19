const FinancialSignal = require('../../../models/FinancialSignal');
const { v4: uuidv4 } = require('uuid');

class SignalGenerator {
  /**
   * Create a new financial signal
   */
  createSignal(data) {
    const {
      userId,
      type,
      name,
      value,
      confidence = 100,
      category = null,
      period,
      data: rawData,
      priority = 3,
      tags = []
    } = data;

    // Generate unique signal ID
    const signalId = uuidv4();

    // Calculate signal hash for deduplication
    const signalHash = this.generateSignalHash({
      userId,
      type,
      category,
      period
    });

    return {
      signalId,
      userId,
      type,
      name,
      value,
      confidence,
      category,
      period,
      data: {
        raw: rawData,
        aggregated: this.aggregateSignalData(rawData),
        metadata: {
          signalHash,
          generatedBy: 'deterministic_engine',
          version: '1.0'
        }
      },
      priority,
      tags: [...tags, type, `priority_${priority}`],
      isActive: true,
      expiresAt: this.calculateExpiry(period)
    };
  }

  /**
   * Generate hash for signal deduplication
   */
  generateSignalHash({ userId, type, category, period }) {
    const hashInput = `${userId}-${type}-${category || 'none'}-${period.startDate}-${period.endDate}`;
    // Simple hash function - in production use crypto
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Aggregate signal data for quick reference
   */
  aggregateSignalData(rawData) {
    if (!rawData) return {};

    const aggregated = {};

    // Extract key metrics based on data type
    if (rawData.total !== undefined) {
      aggregated.total = rawData.total;
    }
    
    if (rawData.percentage !== undefined) {
      aggregated.percentage = rawData.percentage;
    }

    if (rawData.count !== undefined) {
      aggregated.count = rawData.count;
    }

    if (rawData.average !== undefined) {
      aggregated.average = rawData.average;
    }

    // Add timestamps
    aggregated.generatedAt = new Date();

    return aggregated;
  }

  /**
   * Calculate signal expiry based on period
   */
  calculateExpiry(period) {
    const expiryDate = new Date();

    if (period && period.endDate) {
      // Keep signal for 30 days after period end
      expiryDate.setTime(new Date(period.endDate).getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      // Default 90 days
      expiryDate.setDate(expiryDate.getDate() + 90);
    }

    return expiryDate;
  }

  /**
   * Check if signal should be generated (avoid duplicates)
   */
  async shouldGenerateSignal(userId, type, categoryId, period) {
    const existingSignal = await FinancialSignal.findOne({
      userId,
      type,
      ...(categoryId && { category: categoryId }),
      'period.startDate': period.startDate,
      'period.endDate': period.endDate,
      isActive: true
    });

    return !existingSignal;
  }

  /**
   * Create multiple signals efficiently
   */
  createBatchSignals(signalsData) {
    return signalsData.map(data => this.createSignal(data));
  }

  /**
   * Prioritize signals based on urgency and impact
   */
  prioritizeSignals(signals) {
    return signals
      .map(signal => ({
        ...signal,
        priorityScore: this.calculatePriorityScore(signal)
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Calculate priority score for sorting
   */
  calculatePriorityScore(signal) {
    let score = 0;

    // Base priority (1-5, higher is more important)
    score += (6 - signal.priority) * 20;

    // Confidence factor
    score += signal.confidence * 0.3;

    // Recency factor
    const age = new Date() - new Date(signal.period?.endDate || new Date());
    const daysOld = age / (1000 * 60 * 60 * 24);
    if (daysOld < 7) score += 10;
    else if (daysOld < 30) score += 5;

    // Value magnitude
    if (signal.value?.delta && Math.abs(signal.value.delta) > 1000) {
      score += 15;
    } else if (signal.value?.delta && Math.abs(signal.value.delta) > 500) {
      score += 10;
    } else if (signal.value?.delta && Math.abs(signal.value.delta) > 100) {
      score += 5;
    }

    return score;
  }

  /**
   * Merge similar signals
   */
  mergeSignals(signals) {
    if (signals.length <= 1) return signals;

    const grouped = {};
    
    signals.forEach(signal => {
      const key = `${signal.type}-${signal.category}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(signal);
    });

    const merged = [];
    Object.values(grouped).forEach(group => {
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        merged.push(this.mergeSignalGroup(group));
      }
    });

    return merged;
  }

  /**
   * Merge a group of similar signals
   */
  mergeSignalGroup(group) {
    const base = group[0];
    
    return {
      ...base,
      name: `${base.name} (${group.length} occurrences)`,
      value: {
        ...base.value,
        occurrences: group.length,
        firstDetected: group[group.length - 1].period?.startDate,
        lastDetected: group[0].period?.endDate
      },
      data: {
        ...base.data,
        mergedFrom: group.map(s => s.signalId)
      },
      priority: Math.min(...group.map(s => s.priority)), // Highest priority (lowest number)
      confidence: group.reduce((sum, s) => sum + s.confidence, 0) / group.length
    };
  }
}

module.exports = new SignalGenerator();