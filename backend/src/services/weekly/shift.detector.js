class ShiftDetector {
  constructor() {
    this.significanceThreshold = 20; // 20% change threshold
    this.volumeThreshold = 50; // Minimum amount for significance
    this.patternWindow = 4; // Weeks to consider for patterns
  }

  /**
   * Detect significant shifts in metrics
   */
  detectShifts(currentMetrics, previousMetrics, historicalMetrics = []) {
    const shifts = [];

    // Income shifts
    if (this.isSignificantChange(currentMetrics.totalIncome, previousMetrics.totalIncome)) {
      shifts.push(this.createShift(
        'income',
        currentMetrics.totalIncome,
        previousMetrics.totalIncome,
        'Total Income'
      ));
    }

    // Expense shifts
    if (this.isSignificantChange(currentMetrics.totalExpenses, previousMetrics.totalExpenses)) {
      shifts.push(this.createShift(
        'expenses',
        currentMetrics.totalExpenses,
        previousMetrics.totalExpenses,
        'Total Expenses'
      ));
    }

    // Savings shifts
    if (this.isSignificantChange(currentMetrics.netSavings, previousMetrics.netSavings)) {
      shifts.push(this.createShift(
        'savings',
        currentMetrics.netSavings,
        previousMetrics.netSavings,
        'Net Savings'
      ));
    }

    // Savings rate shifts
    if (this.isSignificantChange(currentMetrics.savingsRate, previousMetrics.savingsRate)) {
      shifts.push(this.createShift(
        'savings_rate',
        currentMetrics.savingsRate,
        previousMetrics.savingsRate,
        'Savings Rate',
        true
      ));
    }

    // Category shifts
    const categoryShifts = this.detectCategoryShifts(
      currentMetrics.topCategories,
      previousMetrics.topCategories
    );
    shifts.push(...categoryShifts);

    // Budget shifts
    const budgetShifts = this.detectBudgetShifts(currentMetrics, previousMetrics);
    shifts.push(...budgetShifts);

    // Pattern shifts (requires historical data)
    if (historicalMetrics.length >= this.patternWindow) {
      const patternShifts = this.detectPatternShifts(currentMetrics, historicalMetrics);
      shifts.push(...patternShifts);
    }

    return this.prioritizeShifts(shifts);
  }

  /**
   * Check if change is significant
   */
  isSignificantChange(current, previous, isPercentage = false) {
    if (previous === 0) {
      return Math.abs(current) > this.volumeThreshold;
    }

    const percentChange = Math.abs((current - previous) / previous * 100);
    
    if (isPercentage) {
      return Math.abs(percentChange) > this.significanceThreshold;
    }

    const absoluteChange = Math.abs(current - previous);
    return percentChange > this.significanceThreshold && absoluteChange > this.volumeThreshold;
  }

  /**
   * Create a shift object
   */
  createShift(metric, current, previous, description, isPercentage = false) {
    const direction = current > previous ? 'up' : current < previous ? 'down' : 'unchanged';
    const magnitude = previous !== 0 
      ? Math.abs((current - previous) / previous * 100)
      : 100;

    return {
      metric,
      direction,
      magnitude,
      description: `${description} ${direction === 'up' ? 'increased' : 'decreased'} by ${magnitude.toFixed(1)}%`,
      previousValue: previous,
      currentValue: current,
      isPercentage,
      significance: this.calculateSignificance(magnitude, Math.abs(current - previous))
    };
  }

  /**
   * Detect shifts in category spending
   */
  detectCategoryShifts(currentCategories, previousCategories) {
    const shifts = [];
    const previousMap = new Map(
      previousCategories.map(c => [c.name, c.amount])
    );

    currentCategories.forEach(cat => {
      const previousAmount = previousMap.get(cat.name) || 0;
      
      if (this.isSignificantChange(cat.amount, previousAmount)) {
        shifts.push({
          metric: 'category',
          direction: cat.amount > previousAmount ? 'up' : 'down',
          magnitude: previousAmount > 0 
            ? Math.abs((cat.amount - previousAmount) / previousAmount * 100)
            : 100,
          description: `${cat.name} spending ${cat.amount > previousAmount ? 'increased' : 'decreased'} significantly`,
          category: cat.name,
          previousValue: previousAmount,
          currentValue: cat.amount,
          significance: this.calculateSignificance(
            Math.abs(cat.amount - previousAmount),
            cat.amount
          )
        });
      }
    });

    return shifts;
  }

  /**
   * Detect shifts in budget status
   */
  detectBudgetShifts(currentMetrics, previousMetrics) {
    const shifts = [];

    if (currentMetrics.budgetsOnTrack !== previousMetrics.budgetsOnTrack) {
      shifts.push({
        metric: 'budgets',
        direction: currentMetrics.budgetsOnTrack > previousMetrics.budgetsOnTrack ? 'up' : 'down',
        magnitude: Math.abs(currentMetrics.budgetsOnTrack - previousMetrics.budgetsOnTrack),
        description: `${Math.abs(currentMetrics.budgetsOnTrack - previousMetrics.budgetsOnTrack)} budgets changed status`,
        previousValue: previousMetrics.budgetsOnTrack,
        currentValue: currentMetrics.budgetsOnTrack,
        significance: 'medium'
      });
    }

    return shifts;
  }

  /**
   * Detect pattern shifts using historical data
   */
  detectPatternShifts(currentMetrics, historicalMetrics) {
    const shifts = [];

    // Calculate moving averages
    const expenseAvg = historicalMetrics
      .slice(-this.patternWindow)
      .reduce((sum, m) => sum + m.totalExpenses, 0) / this.patternWindow;

    if (this.isSignificantChange(currentMetrics.totalExpenses, expenseAvg)) {
      shifts.push({
        metric: 'expense_pattern',
        direction: currentMetrics.totalExpenses > expenseAvg ? 'up' : 'down',
        magnitude: Math.abs((currentMetrics.totalExpenses - expenseAvg) / expenseAvg * 100),
        description: `Spending is ${currentMetrics.totalExpenses > expenseAvg ? 'above' : 'below'} your 4-week average`,
        average: expenseAvg,
        currentValue: currentMetrics.totalExpenses,
        significance: 'medium'
      });
    }

    return shifts;
  }

  /**
   * Calculate significance level
   */
  calculateSignificance(percentChange, absoluteChange) {
    if (percentChange > 100 || absoluteChange > 1000) return 'high';
    if (percentChange > 50 || absoluteChange > 500) return 'medium';
    return 'low';
  }

  /**
   * Prioritize shifts (most significant first)
   */
  prioritizeShifts(shifts) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return shifts.sort((a, b) => {
      // First by significance
      const sigDiff = (priorityOrder[b.significance] || 0) - (priorityOrder[a.significance] || 0);
      if (sigDiff !== 0) return sigDiff;
      
      // Then by magnitude
      return b.magnitude - a.magnitude;
    });
  }

  /**
   * Get top shifts (max 5)
   */
  getTopShifts(shifts, max = 5) {
    return this.prioritizeShifts(shifts).slice(0, max);
  }

  /**
   * Detect anomalies in weekly pattern
   */
  detectAnomalies(metrics, historicalMetrics) {
    const anomalies = [];

    if (historicalMetrics.length < 4) return anomalies;

    // Calculate means and standard deviations
    const expenseMean = historicalMetrics.reduce((sum, m) => sum + m.totalExpenses, 0) / historicalMetrics.length;
    const expenseStd = Math.sqrt(
      historicalMetrics.reduce((sum, m) => sum + Math.pow(m.totalExpenses - expenseMean, 2), 0) / 
      historicalMetrics.length
    );

    // Check if current is anomaly (> 2 standard deviations)
    if (Math.abs(metrics.totalExpenses - expenseMean) > 2 * expenseStd) {
      anomalies.push({
        type: 'expense_anomaly',
        description: 'Unusual spending pattern detected',
        expected: expenseMean,
        actual: metrics.totalExpenses,
        deviation: Math.abs(metrics.totalExpenses - expenseMean) / expenseStd
      });
    }

    return anomalies;
  }
}

module.exports = new ShiftDetector();