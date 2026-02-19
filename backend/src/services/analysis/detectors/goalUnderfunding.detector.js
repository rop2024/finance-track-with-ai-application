const Transaction = require('../../../models/Transaction');
const mongoose = require('mongoose');

class GoalUnderfundingDetector {
  /**
   * Analyze goal funding status
   */
  async analyzeGoalFunding(goal) {
    const now = new Date();
    const targetDate = goal.targetDate;
    const startDate = goal.startDate || goal.createdAt;

    // Calculate required monthly contribution
    const monthsRemaining = this.getMonthsBetween(now, targetDate);
    const amountRemaining = goal.targetAmount - goal.currentAmount;
    const requiredMonthly = amountRemaining / Math.max(1, monthsRemaining);

    // Get actual monthly contributions
    const contributions = await this.getMonthlyContributions(goal);
    const currentMonthly = contributions.length > 0 
      ? contributions[contributions.length - 1].amount 
      : 0;

    // Calculate if on track
    const averageMonthly = contributions.reduce((sum, c) => sum + c.amount, 0) / 
                          Math.max(1, contributions.length);
    
    const willMeetTarget = averageMonthly >= requiredMonthly;
    const projectedCompletionDate = this.projectCompletionDate(
      goal.currentAmount,
      averageMonthly,
      goal.targetAmount
    );

    // Check if stalled
    const lastContribution = goal.contributions.length > 0 
      ? goal.contributions[goal.contributions.length - 1].date 
      : startDate;
    
    const daysSinceLastContribution = Math.ceil(
      (now - lastContribution) / (1000 * 60 * 60 * 24)
    );
    
    const isStalled = daysSinceLastContribution > 30 && goal.currentAmount < goal.targetAmount;

    // Calculate shortfall
    const shortfall = requiredMonthly - averageMonthly;
    const shortfallPercentage = requiredMonthly > 0 
      ? (shortfall / requiredMonthly) * 100 
      : 0;

    // Determine severity
    const severity = this.determineSeverity(
      shortfallPercentage,
      monthsRemaining,
      isStalled
    );

    return {
      isUnderfunded: averageMonthly < requiredMonthly,
      severity,
      requiredMonthly,
      currentMonthly,
      averageMonthly,
      shortfall,
      shortfallPercentage,
      monthsRemaining,
      amountRemaining,
      willMeetTarget,
      projectedCompletionDate,
      isStalled,
      lastContribution,
      daysSinceLastContribution,
      contributionHistory: contributions,
      recommendations: this.generateRecommendations(goal, {
        requiredMonthly,
        averageMonthly,
        monthsRemaining,
        isStalled
      })
    };
  }

  /**
   * Get monthly contribution history
   */
  async getMonthlyContributions(goal) {
    const monthlyMap = {};

    goal.contributions.forEach(contribution => {
      const date = new Date(contribution.date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          period: key,
          amount: 0,
          count: 0,
          date: date
        };
      }
      
      monthlyMap[key].amount += contribution.amount;
      monthlyMap[key].count++;
    });

    return Object.values(monthlyMap).sort((a, b) => a.date - b.date);
  }

  /**
   * Get months between two dates
   */
  getMonthsBetween(startDate, endDate) {
    const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthsDiff = endDate.getMonth() - startDate.getMonth();
    return yearsDiff * 12 + monthsDiff;
  }

  /**
   * Project completion date based on current rate
   */
  projectCompletionDate(currentAmount, monthlyRate, targetAmount) {
    if (monthlyRate <= 0) return null;
    
    const amountRemaining = targetAmount - currentAmount;
    const monthsNeeded = Math.ceil(amountRemaining / monthlyRate);
    
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + monthsNeeded);
    
    return projectedDate;
  }

  /**
   * Determine underfunding severity
   */
  determineSeverity(shortfallPercentage, monthsRemaining, isStalled) {
    if (isStalled) return 'high';
    if (monthsRemaining < 3 && shortfallPercentage > 30) return 'high';
    if (shortfallPercentage > 50) return 'high';
    if (shortfallPercentage > 25) return 'medium';
    if (shortfallPercentage > 10) return 'low';
    return 'none';
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(goal, analysis) {
    const recommendations = [];

    if (analysis.isStalled) {
      recommendations.push('Resume contributions to this goal');
      recommendations.push('Consider setting up automatic monthly transfers');
    }

    if (analysis.shortfall > 0) {
      recommendations.push(
        `Increase monthly contribution by $${analysis.shortfall.toFixed(2)} to stay on track`
      );
    }

    if (analysis.monthsRemaining < 6 && analysis.shortfallPercentage > 20) {
      recommendations.push('Consider extending target date or reducing goal amount');
    }

    if (analysis.averageMonthly < 10) {
      recommendations.push('Even small regular contributions add up over time');
    }

    return recommendations;
  }

  /**
   * Analyze all active goals
   */
  async analyzeAllGoals(userId) {
    const goals = await require('../../../models/SavingsGoal').find({
      userId,
      status: 'active'
    });

    const results = [];
    for (const goal of goals) {
      results.push(await this.analyzeGoalFunding(goal));
    }

    return results;
  }
}

module.exports = new GoalUnderfundingDetector();