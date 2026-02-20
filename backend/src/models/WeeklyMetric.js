const mongoose = require('mongoose');

const weeklyMetricSchema = new mongoose.Schema({
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
    // Financial metrics
    totalIncome: Number,
    totalExpenses: Number,
    netSavings: Number,
    savingsRate: Number,
    
    // Transaction metrics
    transactionCount: Number,
    uniqueCategories: Number,
    largestExpense: {
      amount: Number,
      category: String,
      description: String
    },
    largestIncome: {
      amount: Number,
      source: String,
      description: String
    },
    
    // Daily averages
    avgDailyIncome: Number,
    avgDailyExpenses: Number,
    avgTransactionValue: Number,
    
    // Category breakdowns
    topCategories: [{
      categoryId: mongoose.Schema.Types.ObjectId,
      name: String,
      amount: Number,
      percentage: Number,
      transactionCount: Number
    }],
    
    // Budget metrics
    budgetsOnTrack: Number,
    budgetsAtRisk: Number,
    totalBudgeted: Number,
    totalBudgetSpent: Number,
    
    // Goal metrics
    goalContributions: Number,
    goalsProgress: Number,
    
    // Subscription metrics
    activeSubscriptions: Number,
    subscriptionCost: Number,
    
    // Trends
    weekdayVsWeekend: {
      weekday: { amount: Number, count: Number },
      weekend: { amount: Number, count: Number }
    },
    
    // Volatility
    expenseVolatility: Number,
    incomeVolatility: Number
  },
  comparisons: {
    vsPreviousWeek: {
      income: Number,
      expenses: Number,
      savings: Number,
      savingsRate: Number
    },
    vsFourWeekAvg: {
      income: Number,
      expenses: Number,
      savings: Number,
      savingsRate: Number
    }
  },
  flags: [{
    type: {
      type: String,
      enum: ['high_spending', 'low_savings', 'budget_breach', 'goal_miss', 'unusual_pattern']
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical']
    },
    description: String,
    metric: String,
    value: Number,
    threshold: Number
  }],
  metadata: {
    dataQuality: Number,
    transactionCoverage: Number,
    generatedAt: Date
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, weekStart: -1 },
    { userId: 1, 'flags.type': 1 }
  ]
});

module.exports = mongoose.model('WeeklyMetric', weeklyMetricSchema);