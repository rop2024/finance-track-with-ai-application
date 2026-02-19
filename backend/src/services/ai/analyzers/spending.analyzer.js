const PromptBuilder = require('../prompts/promptBuilder.service');
const GeminiClient = require('../clients/gemini.client');
const SchemaValidator = require('../validation/schemaValidator');
const DataSanitizer = require('../security/dataSanitizer');
const ResponseGuard = require('../security/responseGuard');
const AIInsight = require('../../../models/AIInsight');
const FinancialSignal = require('../../../models/FinancialSignal');

class SpendingAnalyzer {
  constructor() {
    this.client = new GeminiClient(process.env.GEMINI_API_KEY, {
      temperature: 0.2,
      model: 'gemini-pro'
    });
  }

  /**
   * Analyze spending patterns
   */
  async analyzeSpending(userId, signals, options = {}) {
    const startTime = Date.now();

    try {
      // Prepare data for analysis
      const analysisData = await this.prepareSpendingData(userId, signals);
      
      // Sanitize data
      const sanitizedData = DataSanitizer.prepareForAnalysis(analysisData, userId);

      // Check if we have sufficient data
      if (sanitizedData._metadata.dataQuality.score < 50) {
        return this.generateInsufficientDataResponse(sanitizedData._metadata.dataQuality);
      }

      // Build prompt
      const prompt = PromptBuilder.buildPrompt('spending', sanitizedData, options);

      // Generate insights
      const response = await this.client.generateStructured(
        prompt,
        require('../validation/schemas/insight.schema')
      );

      // Validate response schema
      const validation = SchemaValidator.validateInsightResponse(response.data);
      if (!validation.isValid) {
        throw new Error(`Invalid response schema: ${JSON.stringify(validation.errors)}`);
      }

      // Apply quality filters
      const filteredResponse = SchemaValidator.filterByConfidence(response.data, 70);
      
      // Guard response
      const guardedResponse = ResponseGuard.guardResponse(filteredResponse);

      // Store insights
      const storedInsights = await this.storeInsights(userId, guardedResponse, signals, {
        processingTime: Date.now() - startTime,
        ...response.metadata
      });

      return {
        insights: storedInsights,
        summary: guardedResponse.summary,
        metadata: {
          processingTime: Date.now() - startTime,
          dataQuality: sanitizedData._metadata.dataQuality,
          tokenUsage: response.metadata
        }
      };

    } catch (error) {
      console.error('Spending analysis failed:', error);
      return this.generateErrorResponse(error);
    }
  }

  /**
   * Prepare spending data from signals
   */
  async prepareSpendingData(userId, signals) {
    // Filter relevant signals
    const categorySignals = signals.filter(s => 
      ['category_aggregation', 'category_delta'].includes(s.type)
    );

    const patternSignals = signals.filter(s => 
      ['growth_trend', 'spending_cluster'].includes(s.type)
    );

    // Organize by period
    const byPeriod = this.organizeByPeriod(signals);

    return {
      userId,
      period: {
        startDate: byPeriod[0]?.period?.startDate || new Date(Date.now() - 30*24*60*60*1000),
        endDate: byPeriod[0]?.period?.endDate || new Date()
      },
      categoryTotals: this.extractCategoryTotals(categorySignals),
      categoryDeltas: this.extractCategoryDeltas(categorySignals),
      topCategories: this.getTopCategories(categorySignals, 5),
      unusualTransactions: this.extractUnusualTransactions(patternSignals),
      patterns: this.extractPatterns(patternSignals),
      totalTransactions: signals.reduce((sum, s) => sum + (s.data?.raw?.count || 0), 0),
      metadata: {
        signalCount: signals.length,
        generatedAt: new Date()
      }
    };
  }

  /**
   * Extract category totals from signals
   */
  extractCategoryTotals(signals) {
    return signals
      .filter(s => s.type === 'category_aggregation')
      .map(s => ({
        categoryId: s.category,
        categoryName: s.data?.raw?.categoryName || 'Unknown',
        categoryType: s.data?.raw?.categoryType || 'expense',
        total: s.value?.current || 0,
        percentageOfTotal: s.value?.percentage || 0,
        count: s.data?.raw?.count || 0,
        avgAmount: s.data?.raw?.avgAmount || 0,
        frequency: s.data?.raw?.frequency
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Extract category deltas from signals
   */
  extractCategoryDeltas(signals) {
    return signals
      .filter(s => s.type === 'category_delta')
      .map(s => ({
        categoryId: s.category,
        categoryName: s.data?.raw?.categoryName || 'Unknown',
        currentTotal: s.value?.current || 0,
        previousTotal: s.value?.previous || 0,
        absoluteDelta: s.value?.delta || 0,
        percentageDelta: s.value?.percentage || 0,
        trend: s.data?.raw?.trend || 'stable',
        isSignificant: Math.abs(s.value?.percentage || 0) > 20
      }));
  }

  /**
   * Get top categories by spending
   */
  getTopCategories(signals, limit) {
    return this.extractCategoryTotals(signals)
      .slice(0, limit)
      .map(c => ({
        name: c.categoryName,
        amount: c.total,
        percentage: c.percentageOfTotal
      }));
  }

  /**
   * Extract unusual transactions from pattern signals
   */
  extractUnusualTransactions(signals) {
    const unusual = [];
    
    signals
      .filter(s => s.type === 'spending_cluster')
      .forEach(s => {
        if (s.data?.raw?.transactions) {
          s.data.raw.transactions.forEach(t => {
            unusual.push({
              date: t.date,
              amount: t.amount,
              category: s.data.raw.categoryName || 'Unknown',
              reason: 'Part of unusual spending cluster'
            });
          });
        }
      });

    return unusual.slice(0, 10);
  }

  /**
   * Extract patterns from signals
   */
  extractPatterns(signals) {
    const growthSignals = signals.filter(s => s.type === 'growth_trend');
    
    if (growthSignals.length === 0) return null;

    return {
      trend: growthSignals[0]?.data?.raw?.trend || 'stable',
      volatility: growthSignals[0]?.value?.volatility,
      seasonal: growthSignals.map(s => s.data?.raw?.seasonal).filter(Boolean),
      clusters: signals.filter(s => s.type === 'spending_cluster').length
    };
  }

  /**
   * Organize signals by period
   */
  organizeByPeriod(signals) {
    const periods = {};
    
    signals.forEach(s => {
      const key = `${s.period?.startDate}-${s.period?.endDate}`;
      if (!periods[key]) {
        periods[key] = {
          period: s.period,
          signals: []
        };
      }
      periods[key].signals.push(s);
    });

    return Object.values(periods).sort((a, b) => 
      new Date(b.period.endDate) - new Date(a.period.endDate)
    );
  }

  /**
   * Store insights in database
   */
  async storeInsights(userId, response, signals, metadata) {
    const storedInsights = [];

    for (const insight of response.insights) {
      // Find related signals
      const relatedSignals = this.findRelatedSignals(insight, signals);

      const aiInsight = new AIInsight({
        userId,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence,
        priority: insight.priority,
        impact: insight.impact,
        dataReferences: relatedSignals.map(signal => ({
          signalId: signal._id,
          type: signal.type,
          value: signal.value
        })),
        actionItems: insight.actionItems,
        metadata: {
          ...metadata,
          modelVersion: 'gemini-pro-1.0'
        },
        status: 'generated',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      await aiInsight.save();
      storedInsights.push(aiInsight);
    }

    return storedInsights;
  }

  /**
   * Find signals related to insight
   */
  findRelatedSignals(insight, signals) {
    const related = [];
    
    insight.dataReferences.forEach(ref => {
      const matching = signals.find(s => 
        s.type === ref.type && 
        s.data?.raw?.categoryName === ref.name
      );
      if (matching) {
        related.push(matching);
      }
    });

    return related;
  }

  /**
   * Generate insufficient data response
   */
  generateInsufficientDataResponse(dataQuality) {
    return {
      insights: [],
      summary: {
        message: 'Insufficient data for meaningful spending analysis.',
        requiredData: [
          'At least 30 days of transaction history',
          'Categorized expenses',
          'Minimum 20 transactions'
        ],
        currentData: dataQuality
      },
      metadata: {
        dataQuality: dataQuality.score,
        recommendation: 'Add more transactions and categorize expenses to receive insights.'
      }
    };
  }

  /**
   * Generate error response
   */
  generateErrorResponse(error) {
    return {
      insights: [],
      summary: {
        message: 'Unable to generate insights at this time.',
        error: error.message
      },
      metadata: {
        error: true,
        timestamp: new Date()
      }
    };
  }
}

module.exports = new SpendingAnalyzer();