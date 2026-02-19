const mongoose = require('mongoose');

const checkpointSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  label: {
    type: String,
    required: true
  },
  description: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  data: {
    budgets: [mongoose.Schema.Types.Mixed],
    goals: [mongoose.Schema.Types.Mixed],
    subscriptions: [mongoose.Schema.Types.Mixed],
    categories: [mongoose.Schema.Types.Mixed],
    transactions: [mongoose.Schema.Types.Mixed],
    summary: {
      budgetCount: Number,
      goalCount: Number,
      subscriptionCount: Number,
      categoryCount: Number,
      transactionCount: Number,
      totalSpent: Number,
      totalIncome: Number,
      netWorth: Number
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['system', 'user', 'suggestion', 'backup'],
      default: 'system'
    },
    suggestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingSuggestion'
    },
    version: { type: Number, default: 1 },
    tags: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for finding latest checkpoints
checkpointSchema.index({ userId: 1, timestamp: -1 });
checkpointSchema.index({ userId: 1, isActive: 1, timestamp: -1 });

module.exports = mongoose.model('Checkpoint', checkpointSchema);