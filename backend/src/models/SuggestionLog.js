const mongoose = require('mongoose');

const suggestionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  suggestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PendingSuggestion',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'created',
      'viewed',
      'approved',
      'rejected',
      'applied',
      'failed',
      'expired',
      'rolled_back',
      'cancelled',
      'conflict_detected',
      'prerequisite_checked',
      'notification_sent',
      'user_feedback'
    ],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  actor: {
    type: {
      type: String,
      enum: ['user', 'system', 'ai', 'scheduler'],
      required: true
    },
    id: mongoose.Schema.Types.ObjectId,
    email: String,
    ipAddress: String,
    userAgent: String
  },
  previousState: mongoose.Schema.Types.Mixed,
  newState: mongoose.Schema.Types.Mixed,
  changes: [{
    field: {
      type: String,
      required: true
    },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    path: String
  }],
  metadata: {
    reason: String,
    source: String,
    duration: Number,
    retryCount: Number,
    relatedIds: [mongoose.Schema.Types.ObjectId],
    tags: [String],
    version: { type: Number, default: 1 }
  },
  outcome: {
    success: {
      type: Boolean,
      default: true
    },
    error: {
      code: String,
      message: String,
      stack: String
    },
    warnings: [String],
    performance: {
      startTime: Date,
      endTime: Date,
      duration: Number
    }
  },
  diff: {
    type: mongoose.Schema.Types.Mixed,
    description: 'JSON diff of changes'
  },
  context: {
    sessionId: String,
    requestId: String,
    environment: String
  }
}, {
  timestamps: true,
  timeseries: {
    timeField: 'timestamp',
    metaField: 'metadata',
    granularity: 'minutes'
  }
});

// Compound indexes for efficient querying
suggestionLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
suggestionLogSchema.index({ suggestionId: 1, timestamp: -1 });
suggestionLogSchema.index({ 'actor.type': 1, timestamp: -1 });
suggestionLogSchema.index({ 'outcome.success': 1, timestamp: -1 });
suggestionLogSchema.index({ 'metadata.tags': 1 });

// Text index for searching
suggestionLogSchema.index({
  'metadata.reason': 'text',
  'outcome.error.message': 'text'
});

// Static method to get audit trail
suggestionLogSchema.statics.getAuditTrail = async function(suggestionId, options = {}) {
  const { limit = 100, includeDetails = true } = options;
  
  const query = this.find({ suggestionId })
    .sort({ timestamp: -1 })
    .limit(limit);
    
  if (!includeDetails) {
    query.select('-previousState -newState -diff');
  }
  
  return await query.lean();
};

// Static method to get user activity summary
suggestionLogSchema.statics.getUserActivity = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
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
        avgDuration: { $avg: '$outcome.performance.duration' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Method to create diff
suggestionLogSchema.methods.createDiff = function() {
  if (!this.previousState || !this.newState) return null;
  
  const diff = {};
  const allKeys = new Set([
    ...Object.keys(this.previousState || {}),
    ...Object.keys(this.newState || {})
  ]);
  
  for (const key of allKeys) {
    if (JSON.stringify(this.previousState?.[key]) !== JSON.stringify(this.newState?.[key])) {
      diff[key] = {
        old: this.previousState?.[key],
        new: this.newState?.[key]
      };
    }
  }
  
  this.diff = diff;
  return diff;
};

module.exports = mongoose.model('SuggestionLog', suggestionLogSchema);