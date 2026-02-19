const mongoose = require('mongoose');

const aiInsightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'spending_pattern',
      'budget_recommendation',
      'savings_opportunity',
      'risk_alert',
      'income_insight',
      'subscription_optimization',
      'goal_progress',
      'financial_health'
    ],
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    index: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
    index: true
  },
  impact: {
    type: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    },
    amount: Number,
    percentage: Number,
    timeframe: String
  },
  dataReferences: [{
    signalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialSignal'
    },
    type: String,
    value: mongoose.Schema.Types.Mixed
  }],
  actionItems: [{
    type: {
      type: String,
      enum: ['review', 'adjust_budget', 'cancel_subscription', 'increase_savings', 'create_goal']
    },
    description: String,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    parameters: mongoose.Schema.Types.Mixed
  }],
  metadata: {
    modelVersion: String,
    processingTime: Number,
    promptTokens: Number,
    responseTokens: Number,
    temperature: Number
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    helpful: Boolean,
    applied: Boolean,
    appliedAt: Date,
    feedbackAt: Date
  },
  status: {
    type: String,
    enum: ['generated', 'viewed', 'actioned', 'dismissed'],
    default: 'generated',
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, status: 1, priority: 1 },
    { userId: 1, type: 1, createdAt: -1 },
    { 'dataReferences.signalId': 1 }
  ]
});

// TTL index for automatic cleanup
aiInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AIInsight', aiInsightSchema);