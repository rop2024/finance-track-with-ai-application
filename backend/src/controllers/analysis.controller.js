const AnalysisService = require('../services/analysis');
const SignalStorage = require('../services/analysis/signal/signal.storage');
const { asyncHandler, ServiceError } = require('../middleware/errorHandler');

/**
 * Get full analysis results
 */
const getFullAnalysis = asyncHandler(async (req, res) => {
  const { runAggregation, runPatterns, runRisks } = req.query;
  
  const options = {
    runAggregation: runAggregation !== 'false',
    runPatterns: runPatterns !== 'false',
    runRisks: runRisks !== 'false',
    storeSignals: req.query.storeSignals !== 'false'
  };

  const results = await AnalysisService.runFullAnalysis(req.userId, options);
  
  res.json({
    success: true,
    data: results
  });
});

/**
 * Get aggregation analysis
 */
const getAggregation = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;
  
  const results = await AnalysisService.aggregation.getAggregatedData(
    req.userId,
    period
  );
  
  res.json({
    success: true,
    data: results
  });
});

/**
 * Get pattern analysis
 */
const getPatterns = asyncHandler(async (req, res) => {
  const { lookbackMonths = 6 } = req.query;
  
  const results = await AnalysisService.pattern.runPatternAnalysis(
    req.userId,
    { lookbackMonths: parseInt(lookbackMonths) }
  );
  
  res.json({
    success: true,
    data: results
  });
});

/**
 * Get risk analysis
 */
const getRisks = asyncHandler(async (req, res) => {
  const results = await AnalysisService.risk.runRiskAnalysis(req.userId);
  
  res.json({
    success: true,
    data: results
  });
});

/**
 * Get all active signals
 */
const getSignals = asyncHandler(async (req, res) => {
  const { types, minPriority, limit } = req.query;
  
  const options = {
    types: types ? types.split(',') : [],
    minPriority: minPriority ? parseInt(minPriority) : 5,
    limit: limit ? parseInt(limit) : 50
  };

  const signals = await SignalStorage.getUserSignals(req.userId, options);
  
  res.json({
    success: true,
    data: signals
  });
});

/**
 * Get signal by ID
 */
const getSignalById = asyncHandler(async (req, res) => {
  const signal = await SignalStorage.getSignalById(req.params.id, req.userId);
  
  if (!signal) {
    throw new ServiceError('Signal not found', 404);
  }

  // Get related signals
  const related = await SignalStorage.getRelatedSignals(
    req.params.id,
    req.userId
  );

  res.json({
    success: true,
    data: {
      signal,
      related
    }
  });
});

/**
 * Update signal status
 */
const updateSignalStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!['active', 'dismissed', 'actioned'].includes(status)) {
    throw new ServiceError('Invalid status', 400);
  }

  const signal = await SignalStorage.updateSignalStatus(
    req.params.id,
    req.userId,
    status
  );

  if (!signal) {
    throw new ServiceError('Signal not found', 404);
  }

  res.json({
    success: true,
    data: signal
  });
});

/**
 * Get signal statistics
 */
const getSignalStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const stats = await SignalStorage.getSignalStats(
    req.userId,
    parseInt(days)
  );
  
  res.json({
    success: true,
    data: stats
  });
});

/**
 * Get dashboard analysis summary
 */
const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await AnalysisService.getDashboardAnalysis(req.userId);
  
  res.json({
    success: true,
    data: summary
  });
});

/**
 * Run targeted analysis on specific category
 */
const analyzeCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { period = 90 } = req.query;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const transactions = await require('../models/Transaction').find({
    userId: req.userId,
    categoryId,
    date: { $gte: startDate, $lte: endDate },
    type: 'expense',
    status: 'completed'
  }).populate('categoryId');

  if (transactions.length === 0) {
    throw new ServiceError('No transactions found for this category', 404);
  }

  // Calculate analysis
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  const average = total / transactions.length;
  const byMonth = {};

  transactions.forEach(t => {
    const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
    byMonth[key] = (byMonth[key] || 0) + t.amount;
  });

  res.json({
    success: true,
    data: {
      category: transactions[0].categoryId,
      period: { start: startDate, end: endDate, days: period },
      summary: {
        total,
        average,
        count: transactions.length,
        frequency: transactions.length / (period / 30) // per month
      },
      monthlyTrend: byMonth,
      transactions: transactions.slice(0, 10) // Last 10 transactions
    }
  });
});

/**
 * Compare two time periods
 */
const comparePeriods = asyncHandler(async (req, res) => {
  const { period1Start, period1End, period2Start, period2End } = req.query;

  if (!period1Start || !period1End || !period2Start || !period2End) {
    throw new ServiceError('All period dates are required', 400);
  }

  const [period1, period2] = await Promise.all([
    AnalysisService.aggregation.getAggregatedData(req.userId, {
      start: new Date(period1Start),
      end: new Date(period1End)
    }),
    AnalysisService.aggregation.getAggregatedData(req.userId, {
      start: new Date(period2Start),
      end: new Date(period2End)
    })
  ]);

  // Calculate deltas
  const deltaCalculator = require('../services/analysis/calculators/delta.calculator');
  
  const comparison = {
    periods: {
      current: { start: period1Start, end: period1End },
      previous: { start: period2Start, end: period2End }
    },
    income: deltaCalculator.calculateDelta(period1.totals.income, period2.totals.income),
    expenses: deltaCalculator.calculateDelta(period1.totals.expenses, period2.totals.expenses),
    net: deltaCalculator.calculateDelta(period1.totals.net, period2.totals.net),
    savingsRate: deltaCalculator.calculateDelta(
      period1.totals.savingsRate,
      period2.totals.savingsRate
    ),
    categoryChanges: []
  };

  // Compare categories
  const categoryMap = new Map();
  period1.categoryTotals.forEach(c => {
    categoryMap.set(c.categoryId.toString(), { current: c });
  });
  
  period2.categoryTotals.forEach(c => {
    const existing = categoryMap.get(c.categoryId.toString());
    if (existing) {
      existing.previous = c;
    } else {
      categoryMap.set(c.categoryId.toString(), { previous: c });
    }
  });

  categoryMap.forEach((value, key) => {
    if (value.current && value.previous) {
      comparison.categoryChanges.push({
        categoryId: key,
        categoryName: value.current.categoryName,
        delta: deltaCalculator.calculateDelta(
          value.current.total,
          value.previous.total
        )
      });
    }
  });

  res.json({
    success: true,
    data: comparison
  });
});

module.exports = {
  getFullAnalysis,
  getAggregation,
  getPatterns,
  getRisks,
  getSignals,
  getSignalById,
  updateSignalStatus,
  getSignalStats,
  getDashboardSummary,
  analyzeCategory,
  comparePeriods
};