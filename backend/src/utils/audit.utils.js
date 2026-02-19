const SuggestionLog = require('../models/SuggestionLog');

class AuditUtils {
  /**
   * Log an action for auditing
   */
  async logAction(data, session = null) {
    const log = new SuggestionLog({
      userId: data.userId,
      suggestionId: data.suggestionId,
      action: data.action,
      actor: data.actor || { type: 'system' },
      previousState: data.previousState,
      newState: data.newState,
      changes: data.changes || this.calculateChanges(data.previousState, data.newState),
      metadata: {
        reason: data.reason,
        source: data.source,
        duration: data.duration,
        relatedIds: data.relatedIds,
        tags: data.tags
      },
      outcome: {
        success: data.success !== false,
        error: data.error,
        warnings: data.warnings
      },
      context: {
        sessionId: data.sessionId,
        requestId: data.requestId,
        environment: process.env.NODE_ENV
      }
    });

    // Create diff
    log.createDiff();

    if (session) {
      await log.save({ session });
    } else {
      await log.save();
    }

    return log;
  }

  /**
   * Calculate changes between two objects
   */
  calculateChanges(oldObj, newObj) {
    if (!oldObj || !newObj) return [];

    const changes = [];

    const allKeys = new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ]);

    for (const key of allKeys) {
      // Skip internal fields
      if (key.startsWith('_')) continue;

      const oldValue = oldObj[key];
      const newValue = newObj[key];

      // Handle nested objects
      if (oldValue && newValue && typeof oldValue === 'object' && typeof newValue === 'object') {
        const nestedChanges = this.calculateChanges(oldValue, newValue);
        changes.push(...nestedChanges.map(c => ({
          ...c,
          field: `${key}.${c.field}`
        })));
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue,
          path: key
        });
      }
    }

    return changes;
  }

  /**
   * Get audit trail for a suggestion
   */
  async getSuggestionAuditTrail(suggestionId, options = {}) {
    const { limit = 100, includeDetails = true } = options;

    const query = SuggestionLog.find({ suggestionId })
      .sort({ timestamp: -1 })
      .limit(limit);

    if (!includeDetails) {
      query.select('-previousState -newState -diff');
    }

    return await query.lean();
  }

  /**
   * Get user's audit history
   */
  async getUserAuditHistory(userId, options = {}) {
    const {
      limit = 100,
      actions = [],
      startDate,
      endDate,
      includeDetails = false
    } = options;

    const query = { userId };

    if (actions.length > 0) {
      query.action = { $in: actions };
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    const logs = await SuggestionLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (!includeDetails) {
      logs.forEach(log => {
        delete log.previousState;
        delete log.newState;
        delete log.diff;
      });
    }

    return logs;
  }

  /**
   * Get action statistics
   */
  async getActionStats(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await SuggestionLog.aggregate([
      {
        $match: {
          userId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: ['$outcome.success', 1, 0] }
          },
          avgDuration: { $avg: '$outcome.performance.duration' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          action: '$_id',
          count: 1,
          successRate: {
            $multiply: [
              { $divide: ['$successCount', '$count'] },
              100
            ]
          },
          avgDuration: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get timeline
    const timeline = await SuggestionLog.aggregate([
      {
        $match: {
          userId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          actions: {
            $push: {
              action: '$_id.action',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    return {
      period: { days, startDate },
      summary: stats,
      timeline
    };
  }

  /**
   * Get audit summary for dashboard
   */
  async getAuditSummary(userId) {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(now.setDate(now.getDate() - 7));

    const [todayCount, weekCount, recentActions] = await Promise.all([
      SuggestionLog.countDocuments({
        userId,
        timestamp: { $gte: today }
      }),
      SuggestionLog.countDocuments({
        userId,
        timestamp: { $gte: weekAgo }
      }),
      SuggestionLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('action timestamp outcome suggestionId')
        .lean()
    ]);

    return {
      today: todayCount,
      thisWeek: weekCount,
      recentActions,
      mostCommon: await this.getMostCommonActions(userId)
    };
  }

  /**
   * Get most common actions
   */
  async getMostCommonActions(userId, limit = 5) {
    return await SuggestionLog.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  }

  /**
   * Export audit log
   */
  async exportAuditLog(userId, options = {}) {
    const {
      format = 'json',
      startDate,
      endDate,
      actions = []
    } = options;

    const query = { userId };

    if (actions.length > 0) {
      query.action = { $in: actions };
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await SuggestionLog.find(query)
      .sort({ timestamp: -1 })
      .lean();

    if (format === 'csv') {
      return this.convertToCSV(logs);
    }

    return {
      exportedAt: new Date(),
      count: logs.length,
      data: logs
    };
  }

  /**
   * Convert logs to CSV
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'action', 'suggestionId', 'success', 'error', 'duration'];
    const rows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp.toISOString(),
        log.action,
        log.suggestionId?.toString() || '',
        log.outcome.success ? 'success' : 'failed',
        log.outcome.error?.message || '',
        log.outcome.performance?.duration || ''
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await SuggestionLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    return {
      deletedCount: result.deletedCount,
      cutoffDate
    };
  }
}

module.exports = new AuditUtils();