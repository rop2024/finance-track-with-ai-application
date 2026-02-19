const mongoose = require('mongoose');

const aiSuggestionSchema = new mongoose.Schema({
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
      'budget_alert',
      'spending_pattern',
      'savings_opportunity',
      'subscription_optimization',
      'category_recommendation',
      'financial_goal',
      'investment_advice',
      'debt_repayment',
      'income_optimization'
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
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
    index: true
  },
  impact: {
    type: {
      type: String,
      enum: ['savings', 'income', 'efficiency', 'risk_reduction']
    },
    amount: Number,
    percentage: Number,
    timeframe: String
  },
  data: {
    category: String,
    amount: Number,
    comparison: {
      period: String,
      value: Number,
      change: Number
    },
    relatedTransactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }]
  },
  action: {
    type: {
      type: String,
      enum: ['create_budget', 'adjust_category', 'cancel_subscription', 'increase_savings', 'review_transactions', 'other']
    },
    parameters: mongoose.Schema.Types.Mixed,
    buttonText: String
  },
  status: {
    type: String,
    enum: ['pending', 'viewed', 'actioned', 'dismissed', 'expired'],
    default: 'pending',
    index: true
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    providedAt: Date
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Suggestions expire after 30 days
      return date;
    }
  },
  metadata: {
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    modelVersion: String,
    contextWindow: {
      startDate: Date,
      endDate: Date
    }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
aiSuggestionSchema.index({ userId: 1, status: 1, priority: 1 });
aiSuggestionSchema.index({ userId: 1, createdAt: -1 });
aiSuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AISuggestion', aiSuggestionSchema);