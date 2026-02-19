const FinancialSignal = require('../../../models/FinancialSignal');

class SignalStorage {
  /**
   * Store a single signal
   */
  async storeSignal(signalData) {
    try {
      const signal = new FinancialSignal(signalData);
      await signal.save();
      return signal;
    } catch (error) {
      console.error('Error storing signal:', error);
      throw error;
    }
  }

  /**
   * Store multiple signals efficiently
   */
  async storeSignals(signalsData) {
    if (!signalsData || signalsData.length === 0) {
      return [];
    }

    try {
      // Deduplicate signals
      const uniqueSignals = await this.deduplicateSignals(signalsData);
      
      if (uniqueSignals.length === 0) {
        return [];
      }

      // Batch insert
      const signals = await FinancialSignal.insertMany(uniqueSignals, {
        ordered: false,
        rawResult: true
      });

      return signals;
    } catch (error) {
      console.error('Error storing signals:', error);
      throw error;
    }
  }

  /**
   * Remove duplicate signals
   */
  async deduplicateSignals(signalsData) {
    const uniqueSignals = [];
    const seenHashes = new Set();

    for (const signal of signalsData) {
      const hash = signal.data?.metadata?.signalHash;
      
      if (!hash) continue;

      // Check if we've already seen this hash in this batch
      if (seenHashes.has(hash)) continue;

      // Check if signal already exists in database
      const exists = await FinancialSignal.findOne({
        'data.metadata.signalHash': hash,
        isActive: true
      });

      if (!exists) {
        seenHashes.add(hash);
        uniqueSignals.push(signal);
      }
    }

    return uniqueSignals;
  }

  /**
   * Get active signals for user
   */
  async getUserSignals(userId, options = {}) {
    const {
      types = [],
      minPriority = 5,
      limit = 50,
      includeInactive = false
    } = options;

    const query = {
      userId,
      ...(includeInactive ? {} : { isActive: true }),
      priority: { $lte: minPriority } // Lower number = higher priority
    };

    if (types.length > 0) {
      query.type = { $in: types };
    }

    const signals = await FinancialSignal.find(query)
      .sort({ priority: 1, createdAt: -1 })
      .limit(limit)
      .populate('category', 'name color icon');

    return signals;
  }

  /**
   * Get signal by ID
   */
  async getSignalById(signalId, userId) {
    return await FinancialSignal.findOne({
      _id: signalId,
      userId
    }).populate('category', 'name color icon');
  }

  /**
   * Update signal status
   */
  async updateSignalStatus(signalId, userId, status) {
    return await FinancialSignal.findOneAndUpdate(
      { _id: signalId, userId },
      { 
        isActive: status === 'active',
        ...(status === 'dismissed' && { dismissedAt: new Date() }),
        ...(status === 'actioned' && { actionedAt: new Date() })
      },
      { new: true }
    );
  }

  /**
   * Archive old signals
   */
  async archiveOldSignals(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await FinancialSignal.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        isActive: true
      },
      {
        isActive: false,
        archivedAt: new Date()
      }
    );
  }

  /**
   * Get signal statistics
   */
  async getSignalStats(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await FinancialSignal.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgPriority: { $avg: '$priority' },
          maxPriority: { $max: '$priority' },
          minPriority: { $min: '$priority' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const total = await FinancialSignal.countDocuments({
      userId,
      createdAt: { $gte: startDate }
    });

    return {
      total,
      byType: stats,
      period: {
        start: startDate,
        end: new Date(),
        days
      }
    };
  }

  /**
   * Clean up expired signals (called by TTL index)
   */
  async cleanupExpiredSignals() {
    return await FinancialSignal.deleteMany({
      expiresAt: { $lt: new Date() }
    });
  }

  /**
   * Bulk update signal priorities
   */
  async bulkUpdatePriorities(updates) {
    const bulkOps = updates.map(({ signalId, priority }) => ({
      updateOne: {
        filter: { _id: signalId },
        update: { priority }
      }
    }));

    return await FinancialSignal.bulkWrite(bulkOps);
  }

  /**
   * Get related signals for context
   */
  async getRelatedSignals(signalId, userId, limit = 5) {
    const signal = await this.getSignalById(signalId, userId);
    if (!signal) return [];

    return await FinancialSignal.find({
      userId,
      _id: { $ne: signalId },
      category: signal.category,
      type: signal.type,
      isActive: true
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}

module.exports = new SignalStorage();