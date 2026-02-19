const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  targetAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  priority: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 4, 5],
    description: '1 = highest priority, 5 = lowest priority',
    index: true
  },
  category: {
    type: String,
    enum: ['emergency_fund', 'vacation', 'big_purchase', 'investment', 'debt_repayment', 'education', 'retirement', 'other'],
    required: true
  },
  targetDate: {
    type: Date,
    required: true,
    index: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  autoSave: {
    enabled: { type: Boolean, default: false },
    amount: Number,
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    dayOfMonth: Number,
    sourceAccount: String,
    lastAutoSaveAt: Date
  },
  contributions: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    notes: String
  }],
  withdrawalRules: {
    allowEarlyWithdrawal: { type: Boolean, default: false },
    penalty: Number,
    minimumBalance: Number
  },
  milestones: [{
    amount: Number,
    achievedAt: Date,
    notified: { type: Boolean, default: false }
  }],
  notes: String,
  metadata: {
    icon: String,
    color: String,
    tags: [String]
  }
}, {
  timestamps: true
});

// Calculate progress percentage
savingsGoalSchema.virtual('progressPercentage').get(function() {
  return (this.currentAmount / this.targetAmount) * 100;
});

// Calculate remaining days
savingsGoalSchema.virtual('remainingDays').get(function() {
  const today = new Date();
  const timeDiff = this.targetDate.getTime() - today.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
});

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);