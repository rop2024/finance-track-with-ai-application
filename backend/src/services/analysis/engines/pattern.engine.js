const Transaction = require('../../../models/Transaction');
const Category = require('../../../models/Category');
const GrowthCalculator = require('../calculators/growth.calculator');
const ClusteringCalculator = require('../calculators/clustering.calculator');
const SignalGenerator = require('../signal/signal.generator');
const SignalStorage = require('../signal/signal.storage');

class PatternEngine {
  constructor() {
    this.growthCalculator = GrowthCalculator;
    this.clusteringCalculator = ClusteringCalculator;
    this.signalGenerator = SignalGenerator;
    this.signalStorage = SignalStorage;
  }

  /**
   * Run complete pattern analysis
   */
  async runPatternAnalysis(userId, options = {}) {
    const {
      lookbackMonths = 6,
      minClusterSize = 3,
      storeSignals = true
    } = options;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    // Fetch transactions
    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).populate('categoryId').lean();

    if (transactions.length === 0) {
      return null;
    }

    // Categorize transactions by type
    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');

    // Run different pattern analyses
    const results = {
      period: { start: startDate, end: endDate, months: lookbackMonths },
      expensePatterns: await this.analyzeExpensePatterns(expenses),
      incomePatterns: await this.analyzeIncomePatterns(income),
      growthPatterns: await this.analyzeGrowthPatterns(transactions),
      clusters: await this.analyzeClusters(expenses, minClusterSize),
      seasonality: await this.analyzeSeasonality(transactions),
      metadata: {
        totalTransactions: transactions.length,
        expenseCount: expenses.length,
        incomeCount: income.length
      }
    };

    // Generate signals
    if (storeSignals) {
      await this.generatePatternSignals(userId, results);
    }

    return results;
  }

  /**
   * Analyze expense patterns
   */
  async analyzeExpensePatterns(expenses) {
    if (expenses.length === 0) return null;

    // Group by category
    const byCategory = {};
    expenses.forEach(e => {
      const catId = e.categoryId?._id?.toString() || 'uncategorized';
      if (!byCategory[catId]) {
        byCategory[catId] = {
          category: e.categoryId,
          transactions: []
        };
      }
      byCategory[catId].transactions.push(e);
    });

    const categoryPatterns = [];
    for (const [catId, data] of Object.entries(byCategory)) {
      const monthlyTotals = this.aggregateMonthlyTotals(data.transactions);
      
      categoryPatterns.push({
        categoryId: catId,
        categoryName: data.category?.name || 'Uncategorized',
        categoryType: data.category?.type || 'uncategorized',
        transactionCount: data.transactions.length,
        totalAmount: data.transactions.reduce((sum, t) => sum + t.amount, 0),
        averageAmount: data.transactions.reduce((sum, t) => sum + t.amount, 0) / data.transactions.length,
        monthlyTotals,
        growthRate: this.growthCalculator.calculateGrowthRates(Object.values(monthlyTotals)),
        pattern: this.identifySpendingPattern(data.transactions)
      });
    }

    return {
      byCategory: categoryPatterns,
      overall: {
        totalExpenses: expenses.reduce((sum, t) => sum + t.amount, 0),
        averagePerTransaction: expenses.reduce((sum, t) => sum + t.amount, 0) / expenses.length,
        transactionFrequency: expenses.length / this.getMonthsBetween(expenses),
        topCategories: categoryPatterns.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5)
      }
    };
  }

  /**
   * Analyze income patterns
   */
  async analyzeIncomePatterns(income) {
    if (income.length === 0) return null;

    const monthlyTotals = this.aggregateMonthlyTotals(income);
    const monthlyValues = Object.values(monthlyTotals);

    return {
      totalIncome: income.reduce((sum, t) => sum + t.amount, 0),
      averagePerTransaction: income.reduce((sum, t) => sum + t.amount, 0) / income.length,
      transactionFrequency: income.length / this.getMonthsBetween(income),
      monthlyTotals,
      stability: this.calculateIncomeStability(monthlyValues),
      isRegular: this.isRegularIncome(income),
      growthRate: this.growthCalculator.calculateGrowthRates(monthlyValues)
    };
  }

  /**
   * Analyze growth patterns
   */
  async analyzeGrowthPatterns(transactions) {
    const monthlyExpenses = this.aggregateMonthlyTotals(
      transactions.filter(t => t.type === 'expense')
    );
    
    const monthlyIncome = this.aggregateMonthlyTotals(
      transactions.filter(t => t.type === 'income')
    );

    const expenseValues = Object.values(monthlyExpenses);
    const incomeValues = Object.values(monthlyIncome);

    return {
      expenses: {
        monthly: monthlyExpenses,
        growth: this.growthCalculator.calculateGrowthRates(expenseValues),
        trend: this.growthCalculator.detectGrowthPattern(expenseValues),
        prediction: this.growthCalculator.predictFutureValues(expenseValues, 3)
      },
      income: {
        monthly: monthlyIncome,
        growth: this.growthCalculator.calculateGrowthRates(incomeValues),
        trend: this.growthCalculator.detectGrowthPattern(incomeValues),
        prediction: this.growthCalculator.predictFutureValues(incomeValues, 3)
      },
      netIncome: {
        monthly: this.calculateMonthlyNet(monthlyIncome, monthlyExpenses),
        trend: this.analyzeNetTrend(monthlyIncome, monthlyExpenses)
      }
    };
  }

  /**
   * Analyze clusters
   */
  async analyzeClusters(transactions, minClusterSize) {
    const clusters = this.clusteringCalculator.detectSpendingClusters(
      transactions,
      { minClusterSize }
    );

    const outliers = this.clusteringCalculator.detectOutliers(clusters);

    return {
      clusters: clusters.map(c => ({
        ...c,
        similar: this.clusteringCalculator.findSimilarPatterns(c, clusters, 0.7)
      })),
      outliers,
      totalClusters: clusters.length,
      totalTransactionsInClusters: clusters.reduce((sum, c) => sum + c.size, 0)
    };
  }

  /**
   * Analyze seasonality
   */
  async analyzeSeasonality(transactions) {
    const monthlyData = {};
    
    transactions.forEach(t => {
      const month = t.date.getMonth();
      const year = t.date.getFullYear();
      const key = `${year}-${month}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          year,
          month,
          income: 0,
          expenses: 0
        };
      }
      
      if (t.type === 'income') {
        monthlyData[key].income += t.amount;
      } else if (t.type === 'expense') {
        monthlyData[key].expenses += t.amount;
      }
    });

    const monthlyAverages = {};
    const months = Array.from({ length: 12 }, (_, i) => i);
    
    months.forEach(month => {
      const monthData = Object.values(monthlyData).filter(d => d.month === month);
      if (monthData.length > 0) {
        monthlyAverages[month] = {
          income: monthData.reduce((sum, d) => sum + d.income, 0) / monthData.length,
          expenses: monthData.reduce((sum, d) => sum + d.expenses, 0) / monthData.length,
          count: monthData.length
        };
      }
    });

    return {
      monthlyAverages,
      seasonalPatterns: this.detectSeasonalPatterns(monthlyAverages)
    };
  }

  /**
   * Generate signals from pattern analysis
   */
  async generatePatternSignals(userId, patterns) {
    const signals = [];

    // Growth signals
    if (patterns.growthPatterns.expenses.growth.averageRate > 0.1) {
      signals.push(this.signalGenerator.createSignal({
        userId,
        type: 'growth_trend',
        name: 'Expenses growing rapidly',
        value: {
          current: patterns.growthPatterns.expenses.growth.averageRate * 100,
          trend: patterns.growthPatterns.expenses.trend
        },
        period: patterns.period,
        data: patterns.growthPatterns.expenses,
        priority: 1
      }));
    }

    // Cluster signals
    patterns.clusters.outliers.forEach(outlier => {
      signals.push(this.signalGenerator.createSignal({
        userId,
        type: 'spending_cluster',
        name: 'Unusual spending cluster detected',
        value: {
          amount: outlier.totalAmount,
          duration: outlier.duration,
          transactions: outlier.size
        },
        period: {
          startDate: outlier.startDate,
          endDate: outlier.endDate
        },
        data: outlier,
        priority: 2
      }));
    });

    // Income stability signals
    if (patterns.incomePatterns && patterns.incomePatterns.stability < 0.7) {
      signals.push(this.signalGenerator.createSignal({
        userId,
        type: 'growth_trend',
        name: 'Income is unstable',
        value: {
          stability: patterns.incomePatterns.stability,
          isRegular: patterns.incomePatterns.isRegular
        },
        period: patterns.period,
        data: patterns.incomePatterns,
        priority: 2
      }));
    }

    if (signals.length > 0) {
      await this.signalStorage.storeSignals(signals);
    }

    return signals;
  }

  // Helper methods
  aggregateMonthlyTotals(transactions) {
    const monthly = {};
    
    transactions.forEach(t => {
      const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
      monthly[key] = (monthly[key] || 0) + t.amount;
    });
    
    return monthly;
  }

  getMonthsBetween(transactions) {
    if (transactions.length < 2) return 1;
    
    const dates = transactions.map(t => t.date).sort((a, b) => a - b);
    const first = dates[0];
    const last = dates[dates.length - 1];
    
    return (last.getFullYear() - first.getFullYear()) * 12 + 
           (last.getMonth() - first.getMonth()) + 1;
  }

  calculateIncomeStability(monthlyValues) {
    if (monthlyValues.length < 3) return 0.5;
    
    const mean = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
    const variance = monthlyValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthlyValues.length;
    const stdDev = Math.sqrt(variance);
    
    return 1 - (stdDev / mean);
  }

  isRegularIncome(income) {
    if (income.length < 3) return false;
    
    const intervals = [];
    for (let i = 1; i < income.length; i++) {
      const days = (income[i].date - income[i-1].date) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean < 0.2; // Less than 20% variation
  }

  calculateMonthlyNet(monthlyIncome, monthlyExpenses) {
    const net = {};
    const allMonths = new Set([...Object.keys(monthlyIncome), ...Object.keys(monthlyExpenses)]);
    
    allMonths.forEach(month => {
      net[month] = (monthlyIncome[month] || 0) - (monthlyExpenses[month] || 0);
    });
    
    return net;
  }

  analyzeNetTrend(monthlyIncome, monthlyExpenses) {
    const netValues = Object.values(this.calculateMonthlyNet(monthlyIncome, monthlyExpenses));
    return this.growthCalculator.detectGrowthPattern(netValues);
  }

  identifySpendingPattern(transactions) {
    if (transactions.length < 3) return 'insufficient_data';
    
    // Check for weekend/weekday patterns
    const weekendCount = transactions.filter(t => {
      const day = t.date.getDay();
      return day === 0 || day === 6;
    }).length;
    
    const weekdayCount = transactions.length - weekendCount;
    
    if (weekendCount > weekdayCount * 2) return 'weekend_focused';
    if (weekdayCount > weekendCount * 2) return 'weekday_focused';
    
    return 'mixed';
  }

  detectSeasonalPatterns(monthlyAverages) {
    const patterns = [];
    
    for (let month = 0; month < 12; month++) {
      if (monthlyAverages[month]) {
        const avg = monthlyAverages[month].expenses;
        const yearlyAvg = Object.values(monthlyAverages)
          .reduce((sum, d) => sum + d.expenses, 0) / Object.keys(monthlyAverages).length;
        
        if (avg > yearlyAvg * 1.3) {
          patterns.push({
            month,
            type: 'high_spending',
            deviation: (avg - yearlyAvg) / yearlyAvg * 100
          });
        } else if (avg < yearlyAvg * 0.7) {
          patterns.push({
            month,
            type: 'low_spending',
            deviation: (yearlyAvg - avg) / yearlyAvg * 100
          });
        }
      }
    }
    
    return patterns;
  }
}

module.exports = new PatternEngine();