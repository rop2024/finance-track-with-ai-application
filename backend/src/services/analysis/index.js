const AggregationEngine = require('./engines/aggregation.engine');
const PatternEngine = require('./engines/pattern.engine');
const RiskEngine = require('./engines/risk.engine');
const SignalGenerator = require('./signal/signal.generator');
const SignalStorage = require('./signal/signal.storage');

class AnalysisService {
  constructor() {
    this.aggregation = AggregationEngine;
    this.pattern = PatternEngine;
    this.risk = RiskEngine;
    this.signalGenerator = SignalGenerator;
    this.signalStorage = SignalStorage;
  }

  /**
   * Run complete financial analysis
   */
  async runFullAnalysis(userId, options = {}) {
    const {
      runAggregation = true,
      runPatterns = true,
      runRisks = true,
      storeSignals = true
    } = options;

    const results = {
      userId,
      analyzedAt: new Date(),
      aggregation: null,
      patterns: null,
      risks: null
    };

    // Run analyses in parallel for efficiency
    const promises = [];

    if (runAggregation) {
      promises.push(
        this.aggregation.runAggregation(userId, { storeSignals })
          .then(result => { results.aggregation = result; })
      );
    }

    if (runPatterns) {
      promises.push(
        this.pattern.runPatternAnalysis(userId, { storeSignals })
          .then(result => { results.patterns = result; })
      );
    }

    if (runRisks) {
      promises.push(
        this.risk.runRiskAnalysis(userId, { storeSignals })
          .then(result => { results.risks = result; })
      );
    }

    await Promise.all(promises);

    return results;
  }

  /**
   * Get summary of all signals
   */
  async getSignalsSummary(userId) {
    const [activeSignals, stats] = await Promise.all([
      this.signalStorage.getUserSignals(userId, { limit: 100 }),
      this.signalStorage.getSignalStats(userId)
    ]);

    return {
      activeCount: activeSignals.length,
      byPriority: this.groupByPriority(activeSignals),
      byType: this.groupByType(activeSignals),
      recentSignals: activeSignals.slice(0, 10),
      stats
    };
  }

  /**
   * Group signals by priority
   */
  groupByPriority(signals) {
    const grouped = {
      high: signals.filter(s => s.priority === 1).length,
      medium: signals.filter(s => s.priority === 2).length,
      low: signals.filter(s => s.priority >= 3).length
    };
    return grouped;
  }

  /**
   * Group signals by type
   */
  groupByType(signals) {
    return signals.reduce((acc, signal) => {
      acc[signal.type] = (acc[signal.type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Get analysis for dashboard
   */
  async getDashboardAnalysis(userId) {
    const [aggregation, signals, risks] = await Promise.all([
      this.aggregation.getAggregatedData(userId, 'month'),
      this.getSignalsSummary(userId),
      this.risk.runRiskAnalysis(userId, { storeSignals: false })
    ]);

    return {
      summary: {
        totalIncome: aggregation.totals.income,
        totalExpenses: aggregation.totals.expenses,
        netSavings: aggregation.totals.net,
        savingsRate: aggregation.totals.savingsRate
      },
      topCategories: aggregation.categoryTotals.slice(0, 5),
      signals: signals.activeCount,
      criticalRisks: risks.overallRiskScore > 70 ? risks.overallRiskScore : null,
      riskBreakdown: {
        budget: risks.budgetRisks.length,
        goals: risks.goalRisks.length,
        cashflow: risks.cashFlowRisks.length
      }
    };
  }
}

module.exports = new AnalysisService();