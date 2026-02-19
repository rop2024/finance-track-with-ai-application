const mongoose = require('mongoose');
const Transaction = require('../../../models/Transaction');
const Category = require('../../../models/Category');
const CategoryCalculator = require('../calculators/category.calculator');
const SignalGenerator = require('../signal/signal.generator');
const SignalStorage = require('../signal/signal.storage');
const { getDateRangeForAnalysis } = require('../../../utils/dateUtils');

class AggregationEngine {
  constructor() {
    this.categoryCalculator = CategoryCalculator;
    this.signalGenerator = SignalGenerator;
    this.signalStorage = SignalStorage;
  }

  /**
   * Run full aggregation analysis for a user
   */
  async runAggregation(userId, options = {}) {
    const {
      periods = [30, 60, 90], // Days to analyze
      storeSignals = true
    } = options;

    const endDate = new Date();
    const results = {};

    for (const days of periods) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const periodKey = `${days}days`;
      
      // Get category totals
      const categoryTotals = await this.categoryCalculator.calculateCategoryTotals(
        userId,
        startDate,
        endDate
      );

      // Get previous period for comparison
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - days);
      
      const categoryDeltas = await this.categoryCalculator.calculateCategoryDeltas(
        userId,
        startDate,
        endDate,
        previousStartDate,
        startDate
      );

      // Get category trends
      const categoryTrends = await this.categoryCalculator.getCategoryTrends(
        userId,
        null,
        6 // Last 6 months
      );

      // Get overall totals
      const totals = await this.calculateTotals(userId, startDate, endDate);
      
      // Get daily averages
      const dailyAverages = await this.calculateDailyAverages(userId, startDate, endDate);

      results[periodKey] = {
        period: { start: startDate, end: endDate, days },
        categoryTotals,
        categoryDeltas,
        categoryTrends,
        totals,
        dailyAverages,
        metadata: {
          generatedAt: new Date(),
          transactionCount: await Transaction.countDocuments({
            userId,
            date: { $gte: startDate, $lte: endDate },
            status: 'completed'
          })
        }
      };

      // Generate and store signals if requested
      if (storeSignals) {
        await this.generateAggregationSignals(userId, results[periodKey], periodKey);
      }
    }

    return results;
  }

  /**
   * Calculate overall totals
   */
  async calculateTotals(userId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ];

    const results = await Transaction.aggregate(pipeline);
    
    const totals = {
      income: 0,
      expenses: 0,
      transfers: 0,
      incomeCount: 0,
      expensesCount: 0,
      transfersCount: 0
    };

    results.forEach(r => {
      if (r._id === 'income') {
        totals.income = r.total;
        totals.incomeCount = r.count;
      } else if (r._id === 'expense') {
        totals.expenses = r.total;
        totals.expensesCount = r.count;
      } else if (r._id === 'transfer') {
        totals.transfers = r.total;
        totals.transfersCount = r.count;
      }
    });

    totals.net = totals.income - totals.expenses;
    totals.savingsRate = totals.income > 0 ? (totals.net / totals.income) * 100 : 0;

    return totals;
  }

  /**
   * Calculate daily averages
   */
  async calculateDailyAverages(userId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$type'
          },
          dailyTotal: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          income: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$dailyTotal', 0] }
          },
          expenses: {
            $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$dailyTotal', 0] }
          }
        }
      },
      {
        $group: {
          _id: null,
          avgIncome: { $avg: '$income' },
          avgExpenses: { $avg: '$expenses' },
          maxIncome: { $max: '$income' },
          maxExpenses: { $max: '$expenses' },
          minIncome: { $min: '$income' },
          minExpenses: { $min: '$expenses' }
        }
      }
    ];

    const results = await Transaction.aggregate(pipeline);
    
    return results[0] || {
      avgIncome: 0,
      avgExpenses: 0,
      maxIncome: 0,
      maxExpenses: 0,
      minIncome: 0,
      minExpenses: 0
    };
  }

  /**
   * Generate signals from aggregation results
   */
  async generateAggregationSignals(userId, periodData, periodKey) {
    const signals = [];

    // Category total signals
    periodData.categoryTotals.forEach(category => {
      if (category.total > 1000) { // High spending category
        signals.push(this.signalGenerator.createSignal({
          userId,
          type: 'category_aggregation',
          name: `High spending in ${category.categoryName}`,
          value: {
            current: category.total,
            percentage: category.percentageOfTotal
          },
          category: category.categoryId,
          period: periodData.period,
          data: category,
          priority: category.percentageOfTotal > 30 ? 1 : 3
        }));
      }
    });

    // Significant delta signals
    periodData.categoryDeltas.deltas.forEach(delta => {
      if (delta.isSignificant) {
        signals.push(this.signalGenerator.createSignal({
          userId,
          type: 'category_delta',
          name: `${delta.trend === 'increasing' ? 'Increase' : 'Decrease'} in ${delta.categoryName}`,
          value: {
            current: delta.currentTotal,
            previous: delta.previousTotal,
            delta: delta.absoluteDelta,
            percentage: delta.percentageDelta
          },
          category: delta.categoryId,
          period: periodData.period,
          data: delta,
          priority: Math.abs(delta.percentageDelta) > 50 ? 1 : 2
        }));
      }
    });

    // Net income/expense signals
    if (periodData.totals.net < 0) {
      signals.push(this.signalGenerator.createSignal({
        userId,
        type: 'category_aggregation',
        name: 'Negative cash flow',
        value: {
          current: periodData.totals.net,
          income: periodData.totals.income,
          expenses: periodData.totals.expenses
        },
        period: periodData.period,
        data: periodData.totals,
        priority: 1
      }));
    }

    // Savings rate signals
    if (periodData.totals.savingsRate < 10) {
      signals.push(this.signalGenerator.createSignal({
        userId,
        type: 'category_aggregation',
        name: 'Low savings rate',
        value: {
          current: periodData.totals.savingsRate,
          target: 20
        },
        period: periodData.period,
        data: periodData.totals,
        priority: 2
      }));
    }

    // Store signals
    if (signals.length > 0) {
      await this.signalStorage.storeSignals(signals);
    }

    return signals;
  }

  /**
   * Get aggregated data for specific period
   */
  async getAggregatedData(userId, period = 'month') {
    const endDate = new Date();
    let startDate;

    switch(period) {
      case 'week':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
    }

    return {
      period,
      categoryTotals: await this.categoryCalculator.calculateCategoryTotals(userId, startDate, endDate),
      totals: await this.calculateTotals(userId, startDate, endDate),
      dailyAverages: await this.calculateDailyAverages(userId, startDate, endDate)
    };
  }
}

module.exports = new AggregationEngine();