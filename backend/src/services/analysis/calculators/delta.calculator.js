class DeltaCalculator {
  /**
   * Calculate absolute and percentage deltas between two values
   */
  calculateDelta(current, previous) {
    const absoluteDelta = current - previous;
    const percentageDelta = previous !== 0 
      ? (absoluteDelta / Math.abs(previous)) * 100 
      : (current !== 0 ? 100 : 0);

    return {
      absolute: absoluteDelta,
      percentage: percentageDelta,
      direction: absoluteDelta > 0 ? 'positive' : absoluteDelta < 0 ? 'negative' : 'stable',
      magnitude: Math.abs(percentageDelta)
    };
  }

  /**
   * Calculate compound growth rate over multiple periods
   */
  calculateCAGR(startValue, endValue, periods) {
    if (startValue === 0) return 0;
    return (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(values, window) {
    const result = [];
    for (let i = 0; i <= values.length - window; i++) {
      const windowValues = values.slice(i, i + window);
      const average = windowValues.reduce((a, b) => a + b, 0) / window;
      result.push({
        period: i + window,
        value: average
      });
    }
    return result;
  }

  /**
   * Detect trend from sequence of values
   */
  detectTrend(values) {
    if (values.length < 3) return 'insufficient_data';

    const deltas = [];
    for (let i = 1; i < values.length; i++) {
      deltas.push(values[i] - values[i - 1]);
    }

    const positiveCount = deltas.filter(d => d > 0).length;
    const negativeCount = deltas.filter(d => d < 0).length;
    const stableCount = deltas.filter(d => d === 0).length;

    const total = deltas.length;
    
    if (positiveCount / total > 0.6) return 'strong_upward';
    if (positiveCount / total > 0.4) return 'weak_upward';
    if (negativeCount / total > 0.6) return 'strong_downward';
    if (negativeCount / total > 0.4) return 'weak_downward';
    if (stableCount / total > 0.5) return 'stable';
    
    return 'volatile';
  }

  /**
   * Calculate seasonal differences
   */
  calculateSeasonalDiffs(currentPeriod, previousPeriod, samePeriodLastYear) {
    return {
      vsPrevious: this.calculateDelta(currentPeriod, previousPeriod),
      vsYearAgo: this.calculateDelta(currentPeriod, samePeriodLastYear),
      isSeasonal: Math.abs(this.calculateDelta(currentPeriod, samePeriodLastYear).percentage) < 
                  Math.abs(this.calculateDelta(currentPeriod, previousPeriod).percentage)
    };
  }

  /**
   * Calculate budget variance
   */
  calculateBudgetVariance(actual, budgeted) {
    const variance = actual - budgeted;
    const variancePercentage = budgeted > 0 ? (variance / budgeted) * 100 : 0;

    return {
      actual,
      budgeted,
      variance,
      variancePercentage,
      status: variance > 0 ? 'over_budget' : variance < 0 ? 'under_budget' : 'on_budget',
      severity: Math.abs(variancePercentage) > 20 ? 'high' : 
                Math.abs(variancePercentage) > 10 ? 'medium' : 'low'
    };
  }

  /**
   * Detect acceleration/deceleration in growth
   */
  detectGrowthChange(values, periods = 3) {
    if (values.length < periods * 2) return null;

    const firstPeriod = values.slice(0, periods);
    const secondPeriod = values.slice(periods, periods * 2);

    const firstAvg = firstPeriod.reduce((a, b) => a + b, 0) / periods;
    const secondAvg = secondPeriod.reduce((a, b) => a + b, 0) / periods;

    const growth = this.calculateDelta(secondAvg, firstAvg);

    return {
      firstPeriodAvg: firstAvg,
      secondPeriodAvg: secondAvg,
      change: growth,
      isAccelerating: growth.absolute > 0 && Math.abs(growth.percentage) > 10,
      isDecelerating: growth.absolute < 0 && Math.abs(growth.percentage) > 10
    };
  }
}

module.exports = new DeltaCalculator();