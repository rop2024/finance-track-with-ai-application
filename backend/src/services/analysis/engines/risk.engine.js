const mongoose = require('mongoose');
const Budget = require('../../../models/Budget');
const SavingsGoal = require('../../../models/SavingsGoal');
const Transaction = require('../../../models/Transaction');
const Category = require('../../../models/Category');
const BudgetDriftDetector = require('../detectors/budgetDrift.detector');
const GoalUnderfundingDetector = require('../detectors/goalUnderfunding.detector');
const SignalGenerator = require('../signal/signal.generator');
const SignalStorage = require('../signal/signal.storage');

class RiskEngine {
  constructor() {
    this.budgetDriftDetector = BudgetDriftDetector;
    this.goalUnderfundingDetector = GoalUnderfundingDetector;
    this.signalGenerator = SignalGenerator;
    this.signalStorage = SignalStorage;
  }

  /**
   * Run comprehensive risk analysis
   */
  async runRiskAnalysis(userId, options = {}) {
    const {
      checkBudgetDrift = true,
      checkGoalUnderfunding = true,
      checkCashFlowRisk = true,
      checkCategoryRisks = true,
      storeSignals = true
    } = options;

    const results = {
      userId,
      analyzedAt: new Date(),
      budgetRisks: [],
      goalRisks: [],
      cashFlowRisks: [],
      categoryRisks: [],
      overallRiskScore: 0
    };

    // Check budget drift
    if (checkBudgetDrift) {
      results.budgetRisks = await this.analyzeBudgetRisks(userId);
    }

    // Check goal underfunding
    if (checkGoalUnderfunding) {
      results.goalRisks = await this.analyzeGoalRisks(userId);
    }

    // Check cash flow risks
    if (checkCashFlowRisk) {
      results.cashFlowRisks = await this.analyzeCashFlowRisks(userId);
    }

    // Check category risks
    if (checkCategoryRisks) {
      results.categoryRisks = await this.analyzeCategoryRisks(userId);
    }

    // Calculate overall risk score
    results.overallRiskScore = this.calculateOverallRiskScore(results);

    // Generate signals
    if (storeSignals) {
      await this.generateRiskSignals(userId, results);
    }

    return results;
  }

  /**
   * Analyze budget-related risks
   */
  async analyzeBudgetRisks(userId) {
    const risks = [];
    
    // Get active budgets
    const budgets = await Budget.find({
      userId,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null }
      ]
    }).populate('categoryId');

    for (const budget of budgets) {
      const driftAnalysis = await this.budgetDriftDetector.analyzeBudgetDrift(budget);
      
      if (driftAnalysis.hasDrift) {
        risks.push({
          type: 'budget_drift',
          severity: driftAnalysis.severity,
          budget: {
            id: budget._id,
            name: budget.name,
            category: budget.categoryId?.name,
            period: budget.period
          },
          currentSpent: driftAnalysis.currentSpent,
          budgetedAmount: budget.amount,
          projectedOvershoot: driftAnalysis.projectedOvershoot,
          daysRemaining: driftAnalysis.daysRemaining,
          recommendations: driftAnalysis.recommendations
        });
      }

      // Check for consistently overspent budgets
      if (driftAnalysis.consistentlyOverspent) {
        risks.push({
          type: 'consistent_overspending',
          severity: 'high',
          budget: {
            id: budget._id,
            name: budget.name,
            category: budget.categoryId?.name
          },
          monthsOverspent: driftAnalysis.monthsOverspent,
          averageOverspend: driftAnalysis.averageOverspend
        });
      }
    }

    return risks;
  }

  /**
   * Analyze goal-related risks
   */
  async analyzeGoalRisks(userId) {
    const risks = [];
    
    // Get active savings goals
    const goals = await SavingsGoal.find({
      userId,
      status: 'active'
    });

    for (const goal of goals) {
      const underfundingAnalysis = await this.goalUnderfundingDetector.analyzeGoalFunding(goal);
      
      if (underfundingAnalysis.isUnderfunded) {
        risks.push({
          type: 'goal_underfunding',
          severity: underfundingAnalysis.severity,
          goal: {
            id: goal._id,
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            targetDate: goal.targetDate
          },
          requiredMonthly: underfundingAnalysis.requiredMonthly,
          currentMonthly: underfundingAnalysis.currentMonthly,
          shortfall: underfundingAnalysis.shortfall,
          projectedCompletionDate: underfundingAnalysis.projectedCompletionDate,
          willMissTarget: underfundingAnalysis.willMissTarget,
          recommendations: underfundingAnalysis.recommendations
        });
      }

      // Check for stalled goals
      if (underfundingAnalysis.isStalled) {
        risks.push({
          type: 'stalled_goal',
          severity: 'medium',
          goal: {
            id: goal._id,
            name: goal.name
          },
          lastContribution: underfundingAnalysis.lastContribution,
          daysSinceLastContribution: underfundingAnalysis.daysSinceLastContribution
        });
      }
    }

    return risks;
  }

  /**
   * Analyze cash flow risks
   */
  async analyzeCashFlowRisks(userId) {
    const risks = [];
    
    // Get last 90 days of transactions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).sort({ date: 1 });

    if (transactions.length === 0) return risks;

    // Calculate daily cash flow
    const dailyFlow = {};
    transactions.forEach(t => {
      const dateStr = t.date.toISOString().split('T')[0];
      if (!dailyFlow[dateStr]) {
        dailyFlow[dateStr] = { income: 0, expenses: 0 };
      }
      if (t.type === 'income') {
        dailyFlow[dateStr].income += t.amount;
      } else if (t.type === 'expense') {
        dailyFlow[dateStr].expenses += t.amount;
      }
    });

    // Check for negative cash flow days
    let negativeDays = 0;
    let consecutiveNegativeDays = 0;
    let maxConsecutiveNegative = 0;

    Object.values(dailyFlow).forEach(day => {
      const net = day.income - day.expenses;
      if (net < 0) {
        negativeDays++;
        consecutiveNegativeDays++;
        maxConsecutiveNegative = Math.max(maxConsecutiveNegative, consecutiveNegativeDays);
      } else {
        consecutiveNegativeDays = 0;
      }
    });

    if (negativeDays > 0) {
      const negativePercentage = (negativeDays / Object.keys(dailyFlow).length) * 100;
      
      if (negativePercentage > 30) {
        risks.push({
          type: 'frequent_negative_flow',
          severity: negativePercentage > 50 ? 'high' : 'medium',
          negativeDays,
          totalDays: Object.keys(dailyFlow).length,
          percentage: negativePercentage,
          maxConsecutiveNegativeDays: maxConsecutiveNegative
        });
      }
    }

    // Check for upcoming large expenses
    const upcomingRisks = await this.analyzeUpcomingExpenses(userId);
    if (upcomingRisks) {
      risks.push(upcomingRisks);
    }

    // Check for low buffer (assuming income > expenses)
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyAverageExpense = totalExpenses / 3; // Over 90 days
    const monthlyAverageIncome = totalIncome / 3;

    const currentBalance = await this.getCurrentBalance(userId);
    const monthsOfExpenses = monthlyAverageExpense > 0 ? currentBalance / monthlyAverageExpense : 0;

    if (monthsOfExpenses < 1) {
      risks.push({
        type: 'low_liquidity',
        severity: monthsOfExpenses < 0.5 ? 'high' : 'medium',
        currentBalance,
        monthlyExpenses: monthlyAverageExpense,
        monthsOfCoverage: monthsOfExpenses,
        recommendedBuffer: monthlyAverageExpense * 3
      });
    }

    return risks;
  }

  /**
   * Analyze category-specific risks
   */
  async analyzeCategoryRisks(userId) {
    const risks = [];
    
    // Get all categories
    const categories = await Category.find({ userId });

    // Get last 3 months of transactions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    for (const category of categories) {
      const transactions = await Transaction.find({
        userId,
        categoryId: category._id,
        date: { $gte: startDate, $lte: endDate },
        type: 'expense',
        status: 'completed'
      });

      if (transactions.length === 0) continue;

      // Calculate monthly totals
      const monthlyTotals = {};
      transactions.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + t.amount;
      });

      const monthlyValues = Object.values(monthlyTotals);
      const avgMonthly = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
      
      // Check for volatility risk
      if (monthlyValues.length >= 3) {
        const variance = monthlyValues.reduce((a, b) => a + Math.pow(b - avgMonthly, 2), 0) / monthlyValues.length;
        const stdDev = Math.sqrt(variance);
        const volatility = stdDev / avgMonthly;

        if (volatility > 0.5) {
          risks.push({
            type: 'category_volatility',
            severity: volatility > 0.8 ? 'high' : 'medium',
            category: {
              id: category._id,
              name: category.name,
              type: category.type
            },
            volatility,
            monthlyAverage: avgMonthly,
            monthlyValues
          });
        }
      }

      // Check for category concentration risk
      const totalExpenses = monthlyValues.reduce((a, b) => a + b, 0);
      const categoryPercentage = (totalExpenses / monthlyValues.length) / avgMonthly;

      if (categoryPercentage > 0.3) { // Category represents >30% of monthly spending
        risks.push({
          type: 'category_concentration',
          severity: categoryPercentage > 0.5 ? 'high' : 'medium',
          category: {
            id: category._id,
            name: category.name
          },
          percentageOfSpending: categoryPercentage * 100,
          monthlyAmount: avgMonthly
        });
      }
    }

    return risks;
  }

  /**
   * Analyze upcoming expenses risk
   */
  async analyzeUpcomingExpenses(userId) {
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    // Get upcoming subscription payments
    const subscriptions = await require('../../../models/Subscription').find({
      userId,
      status: 'active',
      'recurrence.nextBillingDate': { $lte: next30Days }
    });

    const upcomingTotal = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
    
    if (upcomingTotal > 0) {
      // Get average daily balance or current balance
      const currentBalance = await this.getCurrentBalance(userId);
      
      if (upcomingTotal > currentBalance * 0.5) {
        return {
          type: 'upcoming_expenses_risk',
          severity: upcomingTotal > currentBalance ? 'high' : 'medium',
          upcomingTotal,
          currentBalance,
          ratioToBalance: upcomingTotal / currentBalance,
          subscriptions: subscriptions.map(s => ({
            name: s.name,
            amount: s.amount,
            dueDate: s.recurrence.nextBillingDate
          }))
        };
      }
    }

    return null;
  }

  /**
   * Get current balance (simplified - would need actual account data)
   */
  async getCurrentBalance(userId) {
    // This is a simplified version - in reality you'd need account data
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const transactions = await Transaction.find({
      userId,
      date: { $gte: last30Days },
      status: 'completed'
    });

    let balance = 0;
    transactions.forEach(t => {
      if (t.type === 'income') balance += t.amount;
      else if (t.type === 'expense') balance -= t.amount;
    });

    return Math.max(0, balance);
  }

  /**
   * Calculate overall risk score (0-100, higher = more risk)
   */
  calculateOverallRiskScore(results) {
    let score = 0;
    let totalWeight = 0;

    const riskWeights = {
      budget_drift: 30,
      consistent_overspending: 40,
      goal_underfunding: 35,
      stalled_goal: 20,
      frequent_negative_flow: 45,
      low_liquidity: 50,
      upcoming_expenses_risk: 30,
      category_volatility: 25,
      category_concentration: 20
    };

    const severityScores = {
      low: 0.3,
      medium: 0.6,
      high: 1.0
    };

    // Score budget risks
    results.budgetRisks.forEach(risk => {
      const weight = riskWeights[risk.type] || 25;
      const severityScore = severityScores[risk.severity] || 0.5;
      score += weight * severityScore;
      totalWeight += weight;
    });

    // Score goal risks
    results.goalRisks.forEach(risk => {
      const weight = riskWeights[risk.type] || 30;
      const severityScore = severityScores[risk.severity] || 0.5;
      score += weight * severityScore;
      totalWeight += weight;
    });

    // Score cash flow risks
    results.cashFlowRisks.forEach(risk => {
      const weight = riskWeights[risk.type] || 35;
      const severityScore = severityScores[risk.severity] || 0.5;
      score += weight * severityScore;
      totalWeight += weight;
    });

    // Score category risks
    results.categoryRisks.forEach(risk => {
      const weight = riskWeights[risk.type] || 20;
      const severityScore = severityScores[risk.severity] || 0.5;
      score += weight * severityScore;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
  }

  /**
   * Generate risk signals
   */
  async generateRiskSignals(userId, risks) {
    const signals = [];

    // High severity risks get immediate signals
    const allRisks = [
      ...risks.budgetRisks,
      ...risks.goalRisks,
      ...risks.cashFlowRisks,
      ...risks.categoryRisks
    ];

    allRisks.forEach(risk => {
      if (risk.severity === 'high') {
        signals.push(this.signalGenerator.createSignal({
          userId,
          type: risk.type === 'budget_drift' ? 'budget_drift' :
                risk.type === 'goal_underfunding' ? 'goal_underfunding' :
                'risk_detected',
          name: this.getRiskName(risk),
          value: this.extractRiskValue(risk),
          period: {
            startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
            endDate: new Date()
          },
          data: risk,
          priority: 1
        }));
      }
    });

    if (signals.length > 0) {
      await this.signalStorage.storeSignals(signals);
    }

    return signals;
  }

  getRiskName(risk) {
    const names = {
      budget_drift: 'Budget drift detected',
      consistent_overspending: 'Consistent overspending pattern',
      goal_underfunding: 'Savings goal underfunded',
      stalled_goal: 'Savings goal stalled',
      frequent_negative_flow: 'Frequent negative cash flow',
      low_liquidity: 'Low liquidity risk',
      upcoming_expenses_risk: 'Large upcoming expenses',
      category_volatility: 'High spending volatility',
      category_concentration: 'High spending concentration'
    };
    return names[risk.type] || 'Financial risk detected';
  }

  extractRiskValue(risk) {
    if (risk.currentSpent) {
      return { spent: risk.currentSpent, budgeted: risk.budgetedAmount };
    }
    if (risk.shortfall) {
      return { shortfall: risk.shortfall, required: risk.requiredMonthly };
    }
    if (risk.negativeDays) {
      return { negativeDays: risk.negativeDays, percentage: risk.percentage };
    }
    return { severity: risk.severity };
  }
}

module.exports = new RiskEngine();