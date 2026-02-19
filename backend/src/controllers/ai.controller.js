const AIService = require('../services/ai');
const SignalStorage = require('../services/analysis/signal/signal.storage');
const { asyncHandler, ServiceError } = require('../middleware/errorHandler');

/**
 * Generate AI insights from financial signals
 */
const generateInsights = asyncHandler(async (req, res) => {
  const { types = ['spending', 'budget', 'savings', 'risk'] } = req.body;

  // Get recent signals
  const signals = await SignalStorage.getUserSignals(req.userId, {
    limit: 100,
    includeInactive: false
  });

  if (signals.length === 0) {
    throw new ServiceError('No financial signals available for analysis', 400);
  }

  const insights = await AIService.generateInsights(req.userId, signals, types);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get integrated analysis
 */
const getIntegratedAnalysis = asyncHandler(async (req, res) => {
  const signals = await SignalStorage.getUserSignals(req.userId, {
    limit: 100,
    includeInactive: false
  });

  if (signals.length === 0) {
    throw new ServiceError('No financial signals available for analysis', 400);
  }

  const analysis = await AIService.getIntegratedAnalysis(req.userId, signals);

  res.json({
    success: true,
    data: analysis
  });
});

/**
 * Get spending insights
 */
const getSpendingInsights = asyncHandler(async (req, res) => {
  const signals = await SignalStorage.getUserSignals(req.userId, {
    types: ['category_aggregation', 'category_delta', 'growth_trend', 'spending_cluster'],
    limit: 50
  });

  if (signals.length === 0) {
    throw new ServiceError('Insufficient spending data for analysis', 400);
  }

  const insights = await AIService.analyzers.spending.analyzeSpending(req.userId, signals);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get budget insights
 */
const getBudgetInsights = asyncHandler(async (req, res) => {
  const signals = await SignalStorage.getUserSignals(req.userId, {
    types: ['budget_drift'],
    limit: 50
  });

  const insights = await AIService.analyzers.budget.analyzeBudget(req.userId, signals);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get savings insights
 */
const getSavingsInsights = asyncHandler(async (req, res) => {
  const signals = await SignalStorage.getUserSignals(req.userId, {
    types: ['goal_underfunding'],
    limit: 50
  });

  const insights = await AIService.analyzers.savings.analyzeSavings(req.userId, signals);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get risk insights
 */
const getRiskInsights = asyncHandler(async (req, res) => {
  const signals = await SignalStorage.getUserSignals(req.userId, {
    types: ['budget_drift', 'goal_underfunding', 'risk_detected'],
    limit: 50
  });

  const insights = await AIService.analyzers.risk.analyzeRisk(req.userId, signals);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get all user insights
 */
const getUserInsights = asyncHandler(async (req, res) => {
  const { types, limit, minConfidence, status } = req.query;

  const options = {
    types: types ? types.split(',') : [],
    limit: limit ? parseInt(limit) : 50,
    minConfidence: minConfidence ? parseInt(minConfidence) : 0,
    status
  };

  const insights = await AIService.getUserInsights(req.userId, options);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Get insight by ID
 */
const getInsightById = asyncHandler(async (req, res) => {
  const insight = await AIInsight.findOne({
    _id: req.params.id,
    userId: req.userId
  }).populate('dataReferences.signalId');

  if (!insight) {
    throw new ServiceError('Insight not found', 404);
  }

  res.json({
    success: true,
    data: insight
  });
});

/**
 * Provide feedback on insight
 */
const provideFeedback = asyncHandler(async (req, res) => {
  const { rating, comment, helpful, applied } = req.body;

  const feedback = {
    rating,
    comment,
    helpful,
    applied,
    appliedAt: applied ? new Date() : null
  };

  const insight = await AIService.provideFeedback(req.params.id, req.userId, feedback);

  res.json({
    success: true,
    data: insight
  });
});

/**
 * Dismiss insight
 */
const dismissInsight = asyncHandler(async (req, res) => {
  const insight = await AIService.dismissInsight(req.params.id, req.userId);

  res.json({
    success: true,
    data: insight
  });
});

/**
 * Get insight statistics
 */
const getInsightStats = asyncHandler(async (req, res) => {
  const stats = await AIService.getInsightStats(req.userId);

  res.json({
    success: true,
    data: stats
  });
});

module.exports = {
  generateInsights,
  getIntegratedAnalysis,
  getSpendingInsights,
  getBudgetInsights,
  getSavingsInsights,
  getRiskInsights,
  getUserInsights,
  getInsightById,
  provideFeedback,
  dismissInsight,
  getInsightStats
};