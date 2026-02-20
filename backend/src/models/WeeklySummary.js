const mongoose = require('mongoose');

const weeklySummarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  weekStart: {
    type: Date,
    required: true,
    index: true
  },
  weekEnd: {
    type: Date,
    required: true
  },
  metrics: {
    income: {
      total: Number,
      average: Number,
      change: Number,
      previousWeek: Number
    },
    expenses: {
      total: Number,
      average: Number,
      change: Number,
      previousWeek: Number,
      byCategory: [{
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        categoryName: String,
        amount: Number,
        percentage: Number,
        change: Number
      }]
    },
    savings: {
      total: Number,
      rate: Number,
      change: Number,
      previousWeek: Number
    },
    budgets: {
      onTrack: Number,
      atRisk: Number,
      exceeded: Number,
      details: [{
        budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget' },
        category: String,
        spent: Number,
        budgeted: Number,
        status: String
      }]
    },
    goals: {
      progress: Number,
      contributions: Number,
      goalsOnTrack: Number,
      goalsBehind: Number
    },
    subscriptions: {
      active: Number,
      totalMonthly: Number,
      newThisWeek: Number,
      expiringSoon: Number
    }
  },
  insights: [{
    id: String,
    type: {
      type: String,
      enum: ['spending', 'savings', 'budget', 'goal', 'subscription', 'income', 'warning', 'achievement']
    },
    title: String,
    description: String,
    impact: {
      amount: Number,
      percentage: Number,
      direction: {
        type: String,
        enum: ['positive', 'negative', 'neutral']
      }
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    actionItems: [String],
    dataReferences: [{
      type: String,
      value: mongoose.Schema.Types.Mixed
    }]
  }],
  significantShifts: [{
    metric: String,
    direction: {
      type: String,
      enum: ['up', 'down', 'unchanged']
    },
    magnitude: Number,
    description: String,
    category: String
  }],
  summary: {
    overview: String,
    topInsight: String,
    highlights: [String],
    lowlights: [String],
    neutral: [String]
  },
  status: {
    type: String,
    enum: ['generated', 'delivered', 'viewed', 'archived'],
    default: 'generated'
  },
  deliveredAt: Date,
  viewedAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 90*24*60*60*1000) // 90 days
  },
  metadata: {
    generationTime: Number,
    dataPoints: Number,
    version: { type: String, default: '1.0' }
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, weekStart: -1 },
    { userId: 1, status: 1, weekStart: -1 },
    { expiresAt: 1 }
  ]
});

// TTL index for automatic cleanup
weeklySummarySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WeeklySummary', weeklySummarySchema);