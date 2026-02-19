const mongoose = require('mongoose');

const categoryPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  metrics: {
    weight: { type: Number, default: 1.0, min: 0, max: 2 },
    suggestionRelevance: { type: Number, default: 1.0, min: 0, max: 1 },
    acceptedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    ignoredCount: { type: Number, default: 0 },
    lastSuggested: Date,
    lastInteraction: Date
  },
  spending: {
    averageMonthly: Number,
    volatility: Number,
    trend: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'volatile']
    },
    typicalAmount: Number,
    frequency: Number // transactions per month
  },
  sensitivity: {
    priceSensitivity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    changeTolerance: {
      type: Number,
      min: 0,
      max: 100,
      default: 20 // percentage
    },
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    }
  },
  patterns: {
    seasonal: [{
      month: Number,
      factor: Number
    }],
    preferredTimeOfMonth: {
      type: String,
      enum: ['beginning', 'middle', 'end', 'spread']
    },
    paymentMethodPreference: String
  },
  feedback: [{
    suggestionId: mongoose.Schema.Types.ObjectId,
    decision: String,
    reason: String,
    impact: Number,
    timestamp: Date
  }]
}, {
  timestamps: true
});

// Compound index for user + category
categoryPreferenceSchema.index({ userId: 1, categoryId: 1 }, { unique: true });
categoryPreferenceSchema.index({ userId: 1, 'metrics.weight': -1 });

module.exports = mongoose.model('CategoryPreference', categoryPreferenceSchema);