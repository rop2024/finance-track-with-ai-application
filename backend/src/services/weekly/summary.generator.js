const mongoose = require('mongoose');
const WeeklySummary = require('../../models/WeeklySummary');
const WeeklyMetric = require('../../models/WeeklyMetric');
const MetricAggregator = require('./metric.aggregator');
const ShiftDetector = require('./shift.detector');
const InsightFilter = require('./insight.filter');
const ReportRenderer = require('./report.renderer');
const GeminiClient = require('../ai/clients/gemini.client');
const weeklySummaryTemplate = require('../ai/prompts/templates/weekly.summary.template');
const UserPreference = require('../../models/UserPreference');
const { getStartOfWeek, getEndOfWeek } = require('../../utils/dateUtils');

class SummaryGenerator {
  constructor() {
    this.aiClient = new GeminiClient(process.env.GEMINI_API_KEY, {
      temperature: 0.3,
      model: 'gemini-pro'
    });
  }

  /**
   * Generate weekly summary for a user
   */
  async generateWeeklySummary(userId, weekDate = new Date()) {
    const startTime = Date.now();

    // Calculate week boundaries
    const weekStart = getStartOfWeek(weekDate);
    const weekEnd = getEndOfWeek(weekDate);

    // Check if summary already exists
    const existing = await WeeklySummary.findOne({
      userId,
      weekStart
    });

    if (existing) {
      return existing;
    }

    try {
      // Aggregate metrics for the week
      const metrics = await MetricAggregator.aggregateWeeklyMetrics(
        userId,
        weekStart,
        weekEnd
      );

      // Get previous week metrics for comparison
      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      
      const previousMetrics = await this.getPreviousWeekMetrics(userId, previousWeekStart);

      // Get historical metrics for context
      const historicalMetrics = await this.getHistoricalMetrics(userId, weekStart, 4);

      // Detect significant shifts
      const shifts = ShiftDetector.detectShifts(
        metrics.metrics,
        previousMetrics,
        historicalMetrics
      );

      // Get user preferences
      const userPrefs = await UserPreference.findOne({ userId }) || {};

      // Prepare data for AI
      const aiData = {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        metrics: this.prepareMetricsForAI(metrics.metrics),
        shifts: shifts.slice(0, 5),
        historicalContext: {
          avgIncome: this.calculateAverage(historicalMetrics, 'totalIncome'),
          avgExpenses: this.calculateAverage(historicalMetrics, 'totalExpenses'),
          avgSavingsRate: this.calculateAverage(historicalMetrics, 'savingsRate')
        },
        userPreferences: {
          riskTolerance: userPrefs.impactPreferences?.maxRiskTolerance,
          primaryGoals: this.extractUserGoals(userPrefs)
        }
      };

      // Generate insights with AI
      const prompt = weeklySummaryTemplate(aiData);
      const aiResponse = await this.aiClient.generateStructured(
        prompt,
        this.getInsightSchema()
      );

      // Filter insights
      const filteredInsights = InsightFilter.filterInsights(
        aiResponse.data.insights,
        metrics.metrics,
        shifts
      );

      // Render the summary
      const rendered = ReportRenderer.renderSummary(
        metrics.metrics,
        filteredInsights,
        shifts,
        weekStart,
        weekEnd
      );

      // Create and save summary
      const summary = new WeeklySummary({
        userId,
        weekStart,
        weekEnd,
        metrics: metrics.metrics,
        insights: filteredInsights,
        significantShifts: shifts.slice(0, 10),
        summary: rendered.summary,
        metadata: {
          generationTime: Date.now() - startTime,
          dataPoints: metrics.metadata.transactionCoverage,
          version: '1.0'
        }
      });

      await summary.save();

      return summary;

    } catch (error) {
      console.error('Error generating weekly summary:', error);
      
      // Create minimal summary with just metrics
      return this.createFallbackSummary(userId, weekStart, weekEnd, error);
    }
  }

  /**
   * Prepare metrics for AI consumption
   */
  prepareMetricsForAI(metrics) {
    return {
      income: {
        total: metrics.totalIncome,
        change: metrics.comparisons?.vsPreviousWeek?.income || 0
      },
      expenses: {
        total: metrics.totalExpenses,
        change: metrics.comparisons?.vsPreviousWeek?.expenses || 0,
        byCategory: metrics.topCategories.map(c => ({
          categoryName: c.name,
          amount: c.amount,
          percentage: c.percentage
        }))
      },
      savings: {
        total: metrics.netSavings,
        rate: metrics.savingsRate,
        change: metrics.comparisons?.vsPreviousWeek?.savings || 0
      },
      budgets: {
        onTrack: metrics.budgetsOnTrack,
        atRisk: metrics.budgetsAtRisk,
        exceeded: 0 // Calculate this
      },
      goals: {
        progress: metrics.goalsProgress,
        contributions: metrics.goalContributions
      },
      subscriptions: {
        active: metrics.activeSubscriptions,
        totalMonthly: metrics.subscriptionCost
      }
    };
  }

  /**
   * Get insight schema for AI validation
   */
  getInsightSchema() {
    return {
      type: 'object',
      properties: {
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { 
                type: 'string',
                enum: ['spending', 'savings', 'budget', 'goal', 'subscription', 'income', 'warning', 'achievement']
              },
              title: { type: 'string', maxLength: 60 },
              description: { type: 'string', maxLength: 150 },
              impact: {
                type: 'object',
                properties: {
                  amount: { type: 'number' },
                  percentage: { type: 'number' },
                  direction: { type: 'string', enum: ['positive', 'negative', 'neutral'] }
                }
              },
              confidence: { type: 'number', minimum: 0, maximum: 100 },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              actionItems: { type: 'array', items: { type: 'string' } }
            },
            required: ['type', 'title', 'description', 'confidence', 'priority']
          },
          minItems: 5,
          maxItems: 5
        },
        summary: {
          type: 'object',
          properties: {
            overview: { type: 'string' },
            topInsight: { type: 'string' },
            highlights: { type: 'array', items: { type: 'string' } },
            lowlights: { type: 'array', items: { type: 'string' } },
            neutral: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['insights', 'summary']
    };
  }

  /**
   * Get previous week metrics
   */
  async getPreviousWeekMetrics(userId, weekStart) {
    const previous = await WeeklyMetric.findOne({
      userId,
      weekStart
    });

    return previous?.metrics || {
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
      savingsRate: 0
    };
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(userId, weekStart, weeks = 4) {
    const metrics = await WeeklyMetric.find({
      userId,
      weekStart: { $lt: weekStart }
    })
      .sort({ weekStart: -1 })
      .limit(weeks)
      .lean();

    return metrics.map(m => m.metrics);
  }

  /**
   * Calculate average of metric across history
   */
  calculateAverage(historicalMetrics, field) {
    if (historicalMetrics.length === 0) return 0;
    
    const sum = historicalMetrics.reduce((acc, m) => acc + (m[field] || 0), 0);
    return sum / historicalMetrics.length;
  }

  /**
   * Extract user goals from preferences
   */
  extractUserGoals(userPrefs) {
    // This would need actual goal data
    return [];
  }

  /**
   * Create fallback summary when AI fails
   */
  async createFallbackSummary(userId, weekStart, weekEnd, error) {
    const metrics = await MetricAggregator.aggregateWeeklyMetrics(
      userId,
      weekStart,
      weekEnd
    );

    const summary = new WeeklySummary({
      userId,
      weekStart,
      weekEnd,
      metrics: metrics.metrics,
      insights: [{
        id: '1',
        type: 'warning',
        title: 'Summary generation incomplete',
        description: 'Unable to generate AI insights at this time. Basic metrics are available.',
        confidence: 100,
        priority: 'low',
        impact: { direction: 'neutral' }
      }],
      significantShifts: [],
      summary: {
        overview: `Financial summary for week of ${weekStart.toISOString().split('T')[0]}`,
        topInsight: 'Basic metrics available',
        highlights: [],
        lowlights: [],
        neutral: ['AI insights temporarily unavailable']
      },
      metadata: {
        generationTime: 0,
        dataPoints: metrics.metadata.transactionCoverage,
        version: '1.0-fallback',
        error: error.message
      }
    });

    await summary.save();
    return summary;
  }

  /**
   * Get user's weekly summaries
   */
  async getUserSummaries(userId, limit = 10) {
    return await WeeklySummary.find({ userId })
      .sort({ weekStart: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get specific weekly summary
   */
  async getSummaryById(userId, summaryId) {
    return await WeeklySummary.findOne({
      _id: summaryId,
      userId
    }).lean();
  }

  /**
   * Mark summary as viewed
   */
  async markAsViewed(userId, summaryId) {
    return await WeeklySummary.findOneAndUpdate(
      { _id: summaryId, userId },
      {
        status: 'viewed',
        viewedAt: new Date()
      },
      { new: true }
    );
  }

  /**
   * Get latest summary for user
   */
  async getLatestSummary(userId) {
    return await WeeklySummary.findOne({ userId })
      .sort({ weekStart: -1 })
      .lean();
  }
}

module.exports = new SummaryGenerator();