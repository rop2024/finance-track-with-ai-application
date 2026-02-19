const mongoose = require('mongoose');

const pendingSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  insightId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIInsight',
    required: true
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
      'spending_alert',
      'transaction_categorization',
      'subscription_optimization',
      'debt_repayment',
      'investment_suggestion'
    ],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  currentState: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    description: 'Snapshot of current data before change'
  },
  proposedChanges: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    description: 'The suggested modifications'
  },
  estimatedImpact: {
    amount: {
      type: Number,
      min: -1000000,
      max: 1000000
    },
    percentage: {
      type: Number,
      min: -100,
      max: 100
    },
    timeframe: {
      type: String,
      enum: ['immediate', 'daily', 'weekly', 'monthly', 'yearly']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    },
    description: String
  },
  prerequisites: [{
    type: {
      type: String,
      enum: ['has_budget', 'has_goal', 'has_category', 'min_balance', 'no_conflict']
    },
    satisfied: {
      type: Boolean,
      default: false
    },
    details: mongoose.Schema.Types.Mixed
  }],
  conflicts: [{
    withSuggestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingSuggestion'
    },
    type: String,
    description: String,
    resolution: {
      type: String,
      enum: ['auto_resolve', 'manual_resolve', 'block']
    }
  }],
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'approved',
      'rejected',
      'expired',
      'applied',
      'failed',
      'rolled_back',
      'cancelled',
      'conflict'
    ],
    default: 'pending',
    index: true
  },
  approvalDetails: {
    approvedAt: Date,
    approvedBy: {
      type: String,
      enum: ['user', 'system', 'auto'],
      default: 'user'
    },
    method: {
      type: String,
      enum: ['click', 'api', 'email', 'notification']
    },
    notes: String,
    ipAddress: String,
    userAgent: String
  },
  executionDetails: {
    executedAt: Date,
    executedBy: {
      type: String,
      enum: ['system', 'user', 'scheduled'],
      default: 'system'
    },
    transactionIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }],
    results: [{
      step: String,
      success: Boolean,
      data: mongoose.Schema.Types.Mixed,
      error: String,
      timestamp: Date
    }],
    error: String,
    stackTrace: String
  },
  rollbackDetails: {
    rolledBackAt: Date,
    rolledBackBy: {
      type: String,
      enum: ['system', 'user', 'auto']
    },
    reason: String,
    originalState: mongoose.Schema.Types.Mixed,
    rollbackTransactionIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }],
    success: Boolean,
    error: String
  },
  reviewDetails: {
    viewedAt: Date,
    viewedCount: { type: Number, default: 0 },
    timeToDecision: Number, // milliseconds
    userRating: {
      type: Number,
      min: 1,
      max: 5
    },
    userFeedback: String
  },
  metadata: {
    source: {
      type: String,
      enum: ['ai', 'system', 'user', 'rule'],
      default: 'ai'
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },
    tags: [String],
    estimatedSavings: Number,
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    category: String,
    version: { type: Number, default: 1 },
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 7*24*60*60*1000) // 7 days
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
pendingSuggestionSchema.index({ userId: 1, status: 1, createdAt: -1 });
pendingSuggestionSchema.index({ userId: 1, type: 1, status: 1 });
pendingSuggestionSchema.index({ 'metadata.expiresAt': 1 }, { expireAfterSeconds: 0 });
pendingSuggestionSchema.index({ insightId: 1 });
pendingSuggestionSchema.index({ 'conflicts.withSuggestionId': 1 });

// Virtual for time remaining
pendingSuggestionSchema.virtual('timeRemaining').get(function() {
  if (!this.metadata.expiresAt) return null;
  const now = new Date();
  const remaining = this.metadata.expiresAt - now;
  return {
    milliseconds: remaining,
    seconds: Math.floor(remaining / 1000),
    minutes: Math.floor(remaining / (1000 * 60)),
    hours: Math.floor(remaining / (1000 * 60 * 60)),
    days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
    expired: remaining <= 0
  };
});

// Virtual for can be applied
pendingSuggestionSchema.virtual('canBeApplied').get(function() {
  return this.status === 'approved' && 
         (!this.metadata.expiresAt || new Date() < this.metadata.expiresAt) &&
         (!this.executionDetails.executedAt);
});

// Virtual for needs review
pendingSuggestionSchema.virtual('needsReview').get(function() {
  return this.status === 'pending' && 
         (!this.reviewDetails.viewedAt || 
          this.reviewDetails.viewedCount < 3);
});

// Method to mark as viewed
pendingSuggestionSchema.methods.markAsViewed = function() {
  this.reviewDetails.viewedCount += 1;
  this.reviewDetails.viewedAt = new Date();
  return this.save();
};

// Method to check prerequisites
pendingSuggestionSchema.methods.checkPrerequisites = async function() {
  for (const prereq of this.prerequisites) {
    switch(prereq.type) {
      case 'has_budget':
        const Budget = mongoose.model('Budget');
        const budget = await Budget.findOne({
          userId: this.userId,
          _id: prereq.details?.budgetId
        });
        prereq.satisfied = !!budget;
        break;
        
      case 'has_goal':
        const SavingsGoal = mongoose.model('SavingsGoal');
        const goal = await SavingsGoal.findOne({
          userId: this.userId,
          _id: prereq.details?.goalId
        });
        prereq.satisfied = !!goal;
        break;
        
      case 'has_category':
        const Category = mongoose.model('Category');
        const category = await Category.findOne({
          userId: this.userId,
          _id: prereq.details?.categoryId
        });
        prereq.satisfied = !!category;
        break;
        
      case 'min_balance':
        const Transaction = mongoose.model('Transaction');
        const balance = await this.calculateBalance();
        prereq.satisfied = balance >= (prereq.details?.amount || 0);
        break;
        
      default:
        prereq.satisfied = true;
    }
  }
  
  await this.save();
  return this.prerequisites.every(p => p.satisfied);
};

// Method to calculate current balance
pendingSuggestionSchema.methods.calculateBalance = async function() {
  const Transaction = mongoose.model('Transaction');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const transactions = await Transaction.find({
    userId: this.userId,
    date: { $gte: thirtyDaysAgo },
    status: 'completed'
  });
  
  return transactions.reduce((balance, t) => {
    if (t.type === 'income') return balance + t.amount;
    if (t.type === 'expense') return balance - t.amount;
    return balance;
  }, 0);
};

// Method to check conflicts
pendingSuggestionSchema.methods.checkConflicts = async function() {
  const conflicting = await this.constructor.find({
    userId: this.userId,
    status: { $in: ['pending', 'approved'] },
    _id: { $ne: this._id },
    'proposedChanges.categoryId': this.proposedChanges.categoryId
  });
  
  this.conflicts = conflicting.map(s => ({
    withSuggestionId: s._id,
    type: 'overlapping_change',
    description: `Conflicts with suggestion: ${s.title}`,
    resolution: 'manual_resolve'
  }));
  
  if (this.conflicts.length > 0) {
    this.status = 'conflict';
  }
  
  await this.save();
  return this.conflicts;
};

module.exports = mongoose.model('PendingSuggestion', pendingSuggestionSchema);