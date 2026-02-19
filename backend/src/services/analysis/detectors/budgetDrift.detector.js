const Transaction = require('../../../models/Transaction');
const mongoose = require('mongoose');

class BudgetDriftDetector {
  /**
   * Analyze budget drift for a specific budget
   */
  async analyzeBudgetDrift(budget) {
    const now = new Date();
    let periodStart, periodEnd;

    // Determine period based on budget configuration
    switch(budget.period) {
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - now.getDay()); // Start of week
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        periodStart = budget.startDate;
        periodEnd = budget.endDate || now;
    }

    // Get transactions for this period
    const transactions = await Transaction.find({
      userId: budget.userId,
      categoryId: budget.categoryId,
      date: { $gte: periodStart, $lte: now }, // Only up to now
      type: 'expense',
      status: 'completed'
    });

    const currentSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const budgetedAmount = budget.amount;
    const daysElapsed = Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
    const daysRemaining = totalDays - daysElapsed;

    // Calculate projected spend
    const dailyRate = currentSpent / daysElapsed;
    const projectedTotal = dailyRate * totalDays;
    const projectedOvershoot = projectedTotal - budgetedAmount;

    // Check historical patterns
    const historicalData = await this.getHistoricalBudgetData(budget, 3); // Last 3 months

    // Determine drift severity
    const driftPercentage = (currentSpent / (budgetedAmount * (daysElapsed / totalDays))) * 100 - 100;
    const severity = this.determineSeverity(driftPercentage, projectedOvershoot, budget.flexibility);

    // Check if consistently overspent
    const consistentlyOverspent = historicalData.every(
      month => month.spent > month.budgeted
    );

    const result = {
      hasDrift: Math.abs(driftPercentage) > 10,
      severity,
      currentSpent,
      budgetedAmount,
      projectedTotal,
      projectedOvershoot: projectedOvershoot > 0 ? projectedOvershoot : 0,
      daysElapsed,
      daysRemaining,
      dailyRate,
      driftPercentage,
      historicalData,
      consistentlyOverspent,
      monthsOverspent: historicalData.filter(m => m.spent > m.budgeted).length,
      averageOverspend: historicalData.reduce((sum, m) => {
        return sum + Math.max(0, m.spent - m.budgeted);
      }, 0) / historicalData.length,
      recommendations: this.generateRecommendations(budget, driftPercentage, projectedOvershoot)
    };

    return result;
  }

  /**
   * Get historical budget performance
   */
  async getHistoricalBudgetData(budget, months) {
    const data = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const transactions = await Transaction.find({
        userId: budget.userId,
        categoryId: budget.categoryId,
        date: { $gte: monthStart, $lte: monthEnd },
        type: 'expense',
        status: 'completed'
      });

      data.push({
        month: `${month.getFullYear()}-${month.getMonth() + 1}`,
        spent: transactions.reduce((sum, t) => sum + t.amount, 0),
        budgeted: budget.amount,
        transactionCount: transactions.length
      });
    }

    return data;
  }

  /**
   * Determine drift severity
   */
  determineSeverity(driftPercentage, projectedOvershoot, flexibility) {
    if (flexibility === 'strict') {
      if (driftPercentage > 30 || projectedOvershoot > 500) return 'high';
      if (driftPercentage > 15 || projectedOvershoot > 200) return 'medium';
    } else {
      if (driftPercentage > 50 || projectedOvershoot > 1000) return 'high';
      if (driftPercentage > 25 || projectedOvershoot > 500) return 'medium';
    }
    
    return driftPercentage > 10 ? 'low' : 'none';
  }

  /**
   * Generate recommendations based on drift
   */
  generateRecommendations(budget, driftPercentage, projectedOvershoot) {
    const recommendations = [];

    if (driftPercentage > 20) {
      recommendations.push('Review recent transactions in this category');
      recommendations.push('Consider setting a spending alert at 80% of budget');
    }

    if (projectedOvershoot > 0) {
      recommendations.push(`Reduce spending by $${(projectedOvershoot / 10).toFixed(2)} per day to stay within budget`);
    }

    if (driftPercentage > 50) {
      recommendations.push('Consider if budget needs to be adjusted for this category');
      recommendations.push('Look for subscription services that might be adding up');
    }

    return recommendations;
  }

  /**
   * Bulk analyze all active budgets
   */
  async analyzeAllBudgets(userId) {
    const budgets = await require('../../../models/Budget').find({
      userId,
      isActive: true
    });

    const results = [];
    for (const budget of budgets) {
      results.push(await this.analyzeBudgetDrift(budget));
    }

    return results;
  }
}

module.exports = new BudgetDriftDetector();