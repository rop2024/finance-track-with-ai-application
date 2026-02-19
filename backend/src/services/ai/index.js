const SpendingAnalyzer = require('./analyzers/spending.analyzer');
const BudgetAnalyzer = require('./analyzers/budget.analyzer');
const SavingsAnalyzer = require('./analyzers/savings.analyzer');
const RiskAnalyzer = require('./analyzers/risk.analyzer');
const PromptBuilder = require('./prompts/promptBuilder.service');
const SchemaValidator = require('./validation/schemaValidator');
const DataSanitizer = require('./security/dataSanitizer');
const ResponseGuard = require('./security/responseGuard');
const AIInsight = require('../../models/AIInsight');

class AIService {
  constructor() {
    this.analyzers = {
      spending: SpendingAnalyzer,
      budget: BudgetAnalyzer,
      savings: SavingsAnalyzer,
      risk: RiskAnalyzer
    };
  }

  /**
   * Generate insights from financial signals
   */
  async generateInsights(userId, signals, types = ['spending', 'budget', 'savings', 'risk']) {
    const results = {};

    for (const type of types) {
      if (this.analyzers[type]) {
        try {
          results[type] = await this.analyzers[type].analyze(userId, signals);
        } catch (error) {
          console.error(`Error in ${type} analysis:`, error);
          results[type] = {
            error: error.message,
            insights: []
          };
        }
      }
    }

    return results;
  }

  /**
   * Get integrated analysis across all types
   */
  async getIntegratedAnalysis(userId, signals) {
    // Run all analyses
    const results = await this.generateInsights(userId, signals, ['spending', 'budget', 'savings', 'risk']);

    // Prepare integrated data
    const integratedData = {
      spending: results.spending?.summary || {},
      budget: results.budget?.summary || {},
      savings: results.savings?.summary || {},
      risk: results.risk?.summary || {},
      insights: [
        ...(results.spending?.insights || []),
        ...(results.budget?.insights || []),
        ...(results.savings?.insights || []),
        ...(results.risk?.insights || [])
      ]
    };

    // Build integrated prompt
    const prompt = PromptBuilder.buildCompositePrompt(
      ['spending', 'budget', 'savings', 'risk'],
      integratedData
    );

    // Generate integrated insights
    const client = new (require('./clients/gemini.client'))(process.env.GEMINI_API_KEY);
    const response = await client.generateStructured(
      prompt,
      require('./validation/schemas/analysis.schema').integratedAnalysisSchema
    );

    // Validate and guard
    const validation = SchemaValidator.validateInsightResponse(response.data, 'integrated');
    if (!validation.isValid) {
      throw new Error(`Invalid integrated response: ${JSON.stringify(validation.errors)}`);
    }

    const guarded = ResponseGuard.guardResponse(response.data);

    return {
      integrated: guarded,
      detailed: results,
      metadata: response.metadata
    };
  }

  /**
   * Get user insights from database
   */
  async getUserInsights(userId, options = {}) {
    const {
      types = [],
      limit = 50,
      minConfidence = 0,
      status = 'generated',
      includeExpired = false
    } = options;

    const query = {
      userId,
      ...(types.length > 0 && { type: { $in: types } }),
      confidence: { $gte: minConfidence },
      ...(status && { status }),
      ...(!includeExpired && { expiresAt: { $gt: new Date() } })
    };

    const insights = await AIInsight.find(query)
      .sort({ priority: 1, confidence: -1, createdAt: -1 })
      .limit(limit)
      .populate('dataReferences.signalId');

    return insights;
  }

  /**
   * Provide feedback on insight
   */
  async provideFeedback(insightId, userId, feedback) {
    const insight = await AIInsight.findOne({ _id: insightId, userId });
    
    if (!insight) {
      throw new Error('Insight not found');
    }

    insight.feedback = {
      ...feedback,
      feedbackAt: new Date()
    };

    if (feedback.helpful) {
      insight.status = 'actioned';
    }

    await insight.save();
    return insight;
  }

  /**
   * Dismiss insight
   */
  async dismissInsight(insightId, userId) {
    const insight = await AIInsight.findOneAndUpdate(
      { _id: insightId, userId },
      { status: 'dismissed' },
      { new: true }
    );

    if (!insight) {
      throw new Error('Insight not found');
    }

    return insight;
  }

  /**
   * Get insight statistics
   */
  async getInsightStats(userId) {
    const stats = await AIInsight.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          maxConfidence: { $max: '$confidence' },
          minConfidence: { $min: '$confidence' },
          actioned: {
            $sum: { $cond: [{ $eq: ['$status', 'actioned'] }, 1, 0] }
          },
          dismissed: {
            $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = await AIInsight.countDocuments({ userId });
    const averageConfidence = await AIInsight.aggregate([
      { $match: { userId } },
      { $group: { _id: null, avg: { $avg: '$confidence' } } }
    ]);

    return {
      total,
      byType: stats,
      averageConfidence: averageConfidence[0]?.avg || 0,
      generatedToday: await AIInsight.countDocuments({
        userId,
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
      })
    };
  }
}

module.exports = new AIService();