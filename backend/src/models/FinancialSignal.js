const mongoose = require('mongoose');

const financialSignalSchema = new mongoose.Schema({
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
      'category_aggregation',
      'category_delta',
      'growth_trend',
      'spending_cluster',
      'budget_drift',
      'goal_underfunding',
      'income_stability',
      'expense_volatility'
    ],
    index: true
  },
  name: {
    type: String,
    required: true
  },
  value: {
    current: mongoose.Schema.Types.Mixed,
    previous: mongoose.Schema.Types.Mixed,
    delta: Number,
    percentage: Number
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 100  // Deterministic = 100% confidence
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  },
  period: {
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    comparisonStartDate: Date,
    comparisonEndDate: Date
  },
  data: {
    raw: mongoose.Schema.Types.Mixed,
    aggregated: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 90*24*60*60*1000) // 90 days
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, type: 1, 'period.startDate': -1 },
    { userId: 1, category: 1, 'period.startDate': -1 },
    { expiresAt: 1 }
  ]
});

// TTL index for automatic cleanup
financialSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FinancialSignal', financialSignalSchema);