const mongoose = require('mongoose');

const suggestionFeedbackSchema = new mongoose.Schema({
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
    unique: true
  },
  insightId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIInsight'
  },
  type: {
    type: String,
    required: true,
    enum: [
      'budget_adjustment',
      'savings_increase',
      'subscription_cancellation',
      'category_creation',
      'budget_creation',
      'goal_adjustment',
      'spending_alert'
    ],
    index: true
  },
  decision: {
    type: String,
    required: true,
    enum: ['accepted', 'rejected', 'ignored', 'modified'],
    index: true
  },
  context: {
    suggestedAt: Date,
    respondedAt: Date,
    responseTime: Number, // milliseconds
    viewedDuration: Number,
    deviceType: String,
    location: String
  },
  reasons: {
    primary: {
      type: String,
      enum: [
        'too_expensive',
        'not_priorities',
        'already_doing',
        'dont_understand',
        'not_now',
        'too_aggressive',
        'not_confident',
        'other'
      ]
    },
    secondary: [String],
    feedback: String,
    customReason: String
  },
  impact: {
    estimatedAmount: Number,
    actualAmount: Number,
    timeframe: String
  },
  modifications: {
    originalValue: mongoose.Schema.Types.Mixed,
    modifiedValue: mongoose.Schema.Types.Mixed,
    reason: String
  },
  outcome: {
    applied: Boolean,
    successful: Boolean,
    error: String,
    rolledBack: Boolean,
    rollbackReason: String
  },
  metadata: {
    source: {
      type: String,
      enum: ['ai', 'system', 'user'],
      default: 'ai'
    },
    priority: String,
    tags: [String]
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, decision: 1, createdAt: -1 },
    { userId: 1, type: 1, decision: 1 },
    { createdAt: 1 },
    { 'reasons.primary': 1 }
  ]
});

// Aggregate feedback patterns
suggestionFeedbackSchema.statics.getPatterns = async function(userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        accepted: {
          $sum: { $cond: [{ $eq: ['$decision', 'accepted'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$decision', 'rejected'] }, 1, 0] }
        },
        avgResponseTime: { $avg: '$context.responseTime' },
        commonReasons: { $push: '$reasons.primary' }
      }
    }
  ]);
};

module.exports = mongoose.model('SuggestionFeedback', suggestionFeedbackSchema);