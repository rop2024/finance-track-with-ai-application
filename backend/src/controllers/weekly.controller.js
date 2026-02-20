const SummaryGenerator = require('../services/weekly/summary.generator');
const WeeklyScheduler = require('../services/weekly/scheduler.service');
const { asyncHandler, ServiceError } = require('../middleware/errorHandler');

/**
 * Get user's weekly summaries
 */
const getSummaries = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const summaries = await SummaryGenerator.getUserSummaries(
    req.userId,
    parseInt(limit)
  );

  res.json({
    success: true,
    data: summaries
  });
});

/**
 * Get specific weekly summary
 */
const getSummaryById = asyncHandler(async (req, res) => {
  const summary = await SummaryGenerator.getSummaryById(
    req.userId,
    req.params.id
  );

  if (!summary) {
    throw new ServiceError('Summary not found', 404);
  }

  // Mark as viewed
  if (summary.status === 'generated') {
    await SummaryGenerator.markAsViewed(req.userId, req.params.id);
  }

  res.json({
    success: true,
    data: summary
  });
});

/**
 * Get latest weekly summary
 */
const getLatestSummary = asyncHandler(async (req, res) => {
  const summary = await SummaryGenerator.getLatestSummary(req.userId);

  if (!summary) {
    // Generate on demand if none exists
    const newSummary = await WeeklyScheduler.generateForUser(req.userId);
    return res.json({
      success: true,
      data: newSummary
    });
  }

  res.json({
    success: true,
    data: summary
  });
});

/**
 * Generate weekly summary on demand
 */
const generateSummary = asyncHandler(async (req, res) => {
  // Check if already generated for this week
  const hasCurrent = await WeeklyScheduler.hasCurrentWeekSummary(req.userId);
  
  if (hasCurrent && !req.query.force) {
    throw new ServiceError('Summary already exists for current week', 400);
  }

  const summary = await WeeklyScheduler.generateForUser(req.userId);

  res.json({
    success: true,
    data: summary
  });
});

/**
 * Get summary statistics
 */
const getSummaryStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const stats = await SummaryGenerator.getSummaryStats(
    req.userId,
    parseInt(days)
  );

  res.json({
    success: true,
    data: stats
  });
});

/**
 * Get summary in bullet format
 */
const getSummaryBullets = asyncHandler(async (req, res) => {
  const summary = await SummaryGenerator.getLatestSummary(req.userId);

  if (!summary) {
    throw new ServiceError('No summary available', 404);
  }

  // Format as bullet points
  const bullets = {
    weekOf: summary.weekStart.toISOString().split('T')[0],
    overview: summary.summary.overview,
    keyMetrics: [
      `Income: $${summary.metrics.income.total.toFixed(2)} (${summary.metrics.income.change > 0 ? '+' : ''}${summary.metrics.income.change.toFixed(1)}%)`,
      `Expenses: $${summary.metrics.expenses.total.toFixed(2)} (${summary.metrics.expenses.change > 0 ? '+' : ''}${summary.metrics.expenses.change.toFixed(1)}%)`,
      `Savings: $${summary.metrics.savings.total.toFixed(2)} (${summary.metrics.savings.rate.toFixed(1)}% rate)`,
      `Budgets: ${summary.metrics.budgets.onTrack} on track, ${summary.metrics.budgets.atRisk} at risk`
    ],
    insights: summary.insights.map(i => `• ${i.title}: ${i.description}`),
    highlights: summary.summary.highlights.map(h => `✓ ${h}`),
    lowlights: summary.summary.lowlights.map(l => `⚠ ${l}`)
  };

  res.json({
    success: true,
    data: bullets
  });
});

/**
 * Get summary trends
 */
const getSummaryTrends = asyncHandler(async (req, res) => {
  const { weeks = 8 } = req.query;

  const summaries = await SummaryGenerator.getUserSummaries(
    req.userId,
    parseInt(weeks)
  );

  const trends = {
    income: summaries.map(s => ({
      week: s.weekStart.toISOString().split('T')[0],
      value: s.metrics.income.total,
      change: s.metrics.income.change
    })),
    expenses: summaries.map(s => ({
      week: s.weekStart.toISOString().split('T')[0],
      value: s.metrics.expenses.total,
      change: s.metrics.expenses.change
    })),
    savings: summaries.map(s => ({
      week: s.weekStart.toISOString().split('T')[0],
      value: s.metrics.savings.total,
      rate: s.metrics.savings.rate
    })),
    average: {
      income: summaries.reduce((sum, s) => sum + s.metrics.income.total, 0) / summaries.length,
      expenses: summaries.reduce((sum, s) => sum + s.metrics.expenses.total, 0) / summaries.length,
      savings: summaries.reduce((sum, s) => sum + s.metrics.savings.total, 0) / summaries.length
    }
  };

  res.json({
    success: true,
    data: trends
  });
});

/**
 * Admin: Get generation stats
 */
const getGenerationStats = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ServiceError('Unauthorized', 403);
  }

  const stats = await WeeklyScheduler.getGenerationStats();

  res.json({
    success: true,
    data: stats
  });
});

/**
 * Admin: Retry failed generations
 */
const retryFailed = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ServiceError('Unauthorized', 403);
  }

  const result = await WeeklyScheduler.retryFailed();

  res.json({
    success: true,
    data: result
  });
});

module.exports = {
  getSummaries,
  getSummaryById,
  getLatestSummary,
  generateSummary,
  getSummaryStats,
  getSummaryBullets,
  getSummaryTrends,
  getGenerationStats,
  retryFailed
};