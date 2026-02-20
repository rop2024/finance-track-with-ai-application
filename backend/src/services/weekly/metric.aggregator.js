const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const SavingsGoal = require('../../models/SavingsGoal');
const Subscription = require('../../models/Subscription');
const Category = require('../../models/Category');
const WeeklyMetric = require('../../models/WeeklyMetric');
const { getStartOfWeek, getEndOfWeek } = require('../../utils/dateUtils');

class MetricAggregator {
  /**
   * Aggregate weekly metrics for a user
   */
  async aggregateWeeklyMetrics(userId, weekStart, weekEnd) {
    const startTime = Date.now();

    // Get all required data in parallel
    const [
      transactions,
      budgets,
      goals,
      subscriptions,
      categories
    ] = await Promise.all([
      this.getTransactions(userId, weekStart, weekEnd),
      Budget.find({ userId, isActive: true }).lean(),
      SavingsGoal.find({ userId, status: 'active' }).lean(),
      Subscription.find({ userId, status: 'active' }).lean(),
      Category.find({ userId }).lean()
    ]);

    // Calculate metrics
    const metrics = await this.calculateMetrics(
      userId,
      transactions,
      budgets,
      goals,
      subscriptions,
      categories,
      weekStart,
      weekEnd
    );

    // Get previous week for comparison
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(weekEnd);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

    const previousMetrics = await this.getPreviousWeekMetrics(userId, previousWeekStart, previousWeekEnd);

    // Calculate comparisons
    const comparisons = this.calculateComparisons(metrics, previousMetrics);

    // Detect flags
    const flags = this.detectFlags(metrics, comparisons);

    const weeklyMetric = new WeeklyMetric({
      userId,
      weekStart,
      weekEnd,
      metrics,
      comparisons,
      flags,
      metadata: {
        dataQuality: this.calculateDataQuality(transactions),
        transactionCoverage: transactions.length,
        generatedAt: new Date(),
        generationTime: Date.now() - startTime
      }
    });

    await weeklyMetric.save();
    return weeklyMetric;
  }

  /**
   * Get transactions for the week
   */
  async getTransactions(userId, weekStart, weekEnd) {
    return Transaction.find({
      userId,
      date: { $gte: weekStart, $lte: weekEnd },
      status: 'completed'
    })
      .populate('categoryId')
      .lean();
  }

  /**
   * Calculate all metrics from raw data
   */
  async calculateMetrics(userId, transactions, budgets, goals, subscriptions, categories, weekStart, weekEnd) {
    // Separate income and expenses
    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');

    // Calculate category breakdown
    const categoryTotals = {};
    expenses.forEach(t => {
      const catId = t.categoryId?._id?.toString() || 'uncategorized';
      const catName = t.categoryId?.name || 'Uncategorized';
      
      if (!categoryTotals[catId]) {
        categoryTotals[catId] = {
          categoryId: catId,
          name: catName,
          amount: 0,
          count: 0
        };
      }
      categoryTotals[catId].amount += t.amount;
      categoryTotals[catId].count++;
    });

    const topCategories = Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(c => ({
        ...c,
        percentage: expenses.length > 0 ? (c.amount / this.sumExpenses(expenses)) * 100 : 0
      }));

    // Find largest transactions
    const largestExpense = expenses.length > 0 
      ? expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0])
      : null;
    
    const largestIncome = income.length > 0
      ? income.reduce((max, t) => t.amount > max.amount ? t : max, income[0])
      : null;

    // Calculate weekday/weekend breakdown
    const weekdayVsWeekend = this.calculateWeekdayVsWeekend(transactions);

    // Calculate budget metrics
    const budgetMetrics = await this.calculateBudgetMetrics(userId, budgets, weekStart, weekEnd);

    // Calculate goal metrics
    const goalMetrics = this.calculateGoalMetrics(goals);

    return {
      totalIncome: this.sumIncome(income),
      totalExpenses: this.sumExpenses(expenses),
      netSavings: this.sumIncome(income) - this.sumExpenses(expenses),
      savingsRate: this.sumIncome(income) > 0 
        ? ((this.sumIncome(income) - this.sumExpenses(expenses)) / this.sumIncome(income)) * 100 
        : 0,
      
      transactionCount: transactions.length,
      uniqueCategories: Object.keys(categoryTotals).length,
      
      largestExpense: largestExpense ? {
        amount: largestExpense.amount,
        category: largestExpense.categoryId?.name || 'Uncategorized',
        description: largestExpense.description
      } : null,
      
      largestIncome: largestIncome ? {
        amount: largestIncome.amount,
        source: largestIncome.description,
        description: largestIncome.description
      } : null,
      
      avgDailyIncome: this.sumIncome(income) / 7,
      avgDailyExpenses: this.sumExpenses(expenses) / 7,
      avgTransactionValue: transactions.length > 0 
        ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
        : 0,
      
      topCategories,
      
      budgetsOnTrack: budgetMetrics.onTrack,
      budgetsAtRisk: budgetMetrics.atRisk,
      totalBudgeted: budgetMetrics.totalBudgeted,
      totalBudgetSpent: budgetMetrics.totalSpent,
      
      goalContributions: goalMetrics.contributions,
      goalsProgress: goalMetrics.progress,
      
      activeSubscriptions: subscriptions.length,
      subscriptionCost: subscriptions.reduce((sum, s) => sum + s.amount, 0),
      
      weekdayVsWeekend,
      
      expenseVolatility: this.calculateVolatility(expenses.map(e => e.amount)),
      incomeVolatility: this.calculateVolatility(income.map(i => i.amount))
    };
  }

  /**
   * Get previous week metrics for comparison
   */
  async getPreviousWeekMetrics(userId, weekStart, weekEnd) {
    const previousMetric = await WeeklyMetric.findOne({
      userId,
      weekStart
    }).lean();

    if (previousMetric) {
      return previousMetric.metrics;
    }

    // If no stored metric, calculate on the fly
    const transactions = await this.getTransactions(userId, weekStart, weekEnd);
    return {
      totalIncome: this.sumIncome(transactions.filter(t => t.type === 'income')),
      totalExpenses: this.sumExpenses(transactions.filter(t => t.type === 'expense')),
      netSavings: this.sumIncome(transactions.filter(t => t.type === 'income')) - 
                 this.sumExpenses(transactions.filter(t => t.type === 'expense')),
      savingsRate: 0
    };
  }

  /**
   * Calculate comparisons between current and previous week
   */
  calculateComparisons(current, previous) {
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / Math.abs(previous)) * 100;
    };

    return {
      vsPreviousWeek: {
        income: calculateChange(current.totalIncome, previous.totalIncome || 0),
        expenses: calculateChange(current.totalExpenses, previous.totalExpenses || 0),
        savings: calculateChange(current.netSavings, previous.netSavings || 0),
        savingsRate: calculateChange(current.savingsRate, previous.savingsRate || 0)
      },
      vsFourWeekAvg: {
        // This would need 4 weeks of history - placeholder for now
        income: 0,
        expenses: 0,
        savings: 0,
        savingsRate: 0
      }
    };
  }

  /**
   * Detect flags based on metrics
   */
  detectFlags(metrics, comparisons) {
    const flags = [];

    // High spending detection
    if (metrics.totalExpenses > metrics.totalIncome * 1.2) {
      flags.push({
        type: 'high_spending',
        severity: 'critical',
        description: 'Spending significantly exceeds income',
        metric: 'expenses',
        value: metrics.totalExpenses,
        threshold: metrics.totalIncome * 1.2
      });
    } else if (metrics.totalExpenses > metrics.totalIncome) {
      flags.push({
        type: 'high_spending',
        severity: 'warning',
        description: 'Spending exceeds income',
        metric: 'expenses',
        value: metrics.totalExpenses,
        threshold: metrics.totalIncome
      });
    }

    // Low savings detection
    if (metrics.savingsRate < 0) {
      flags.push({
        type: 'low_savings',
        severity: 'critical',
        description: 'Negative savings rate',
        metric: 'savingsRate',
        value: metrics.savingsRate,
        threshold: 0
      });
    } else if (metrics.savingsRate < 10) {
      flags.push({
        type: 'low_savings',
        severity: 'warning',
        description: 'Savings rate below 10%',
        metric: 'savingsRate',
        value: metrics.savingsRate,
        threshold: 10
      });
    }

    // Significant changes
    if (Math.abs(comparisons.vsPreviousWeek.expenses) > 50) {
      flags.push({
        type: 'unusual_pattern',
        severity: 'warning',
        description: `Expenses ${comparisons.vsPreviousWeek.expenses > 0 ? 'increased' : 'decreased'} significantly`,
        metric: 'expenses',
        value: comparisons.vsPreviousWeek.expenses,
        threshold: 50
      });
    }

    return flags;
  }

  /**
   * Calculate budget metrics
   */
  async calculateBudgetMetrics(userId, budgets, weekStart, weekEnd) {
    let onTrack = 0;
    let atRisk = 0;
    let totalBudgeted = 0;
    let totalSpent = 0;

    for (const budget of budgets) {
      const spent = await Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            categoryId: budget.categoryId,
            date: { $gte: weekStart, $lte: weekEnd },
            type: 'expense',
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const weeklySpent = spent.length > 0 ? spent[0].total : 0;
      totalSpent += weeklySpent;
      totalBudgeted += budget.amount;

      // Calculate weekly budget (monthly/4)
      const weeklyBudget = budget.amount / 4;
      
      if (weeklySpent <= weeklyBudget) {
        onTrack++;
      } else if (weeklySpent <= weeklyBudget * 1.2) {
        atRisk++;
      }
    }

    return { onTrack, atRisk, totalBudgeted, totalSpent };
  }

  /**
   * Calculate goal metrics
   */
  calculateGoalMetrics(goals) {
    let contributions = 0;
    let totalProgress = 0;

    goals.forEach(goal => {
      // Get contributions from this week
      const weeklyContributions = goal.contributions?.filter(c => {
        const contribDate = new Date(c.date);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return contribDate >= oneWeekAgo;
      }) || [];

      contributions += weeklyContributions.reduce((sum, c) => sum + c.amount, 0);
      totalProgress += goal.currentAmount / goal.targetAmount;
    });

    return {
      contributions,
      progress: goals.length > 0 ? (totalProgress / goals.length) * 100 : 0
    };
  }

  /**
   * Calculate weekday vs weekend spending
   */
  calculateWeekdayVsWeekend(transactions) {
    const result = {
      weekday: { amount: 0, count: 0 },
      weekend: { amount: 0, count: 0 }
    };

    transactions.forEach(t => {
      const day = t.date.getDay();
      const isWeekend = day === 0 || day === 6;
      
      if (isWeekend) {
        result.weekend.amount += t.amount;
        result.weekend.count++;
      } else {
        result.weekday.amount += t.amount;
        result.weekday.count++;
      }
    });

    return result;
  }

  /**
   * Calculate volatility (coefficient of variation)
   */
  calculateVolatility(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  /**
   * Calculate data quality score
   */
  calculateDataQuality(transactions) {
    if (transactions.length === 0) return 0;
    
    const categorized = transactions.filter(t => t.categoryId).length;
    return (categorized / transactions.length) * 100;
  }

  /**
   * Helper methods for sums
   */
  sumIncome(income) {
    return income.reduce((sum, t) => sum + t.amount, 0);
  }

  sumExpenses(expenses) {
    return expenses.reduce((sum, t) => sum + t.amount, 0);
  }
}

module.exports = new MetricAggregator();