class GrowthCalculator {
  /**
   * Calculate growth rates for multiple categories
   */
  calculateGrowthRates(values, options = {}) {
    const {
      annualize = false,
      periods = values.length - 1,
      method = 'simple' // simple, compound, exponential
    } = options;

    if (values.length < 2) return null;

    const rates = [];
    for (let i = 1; i < values.length; i++) {
      const previous = values[i - 1];
      const current = values[i];
      
      if (method === 'simple') {
        rates.push(previous !== 0 ? (current - previous) / previous : 0);
      } else if (method === 'compound') {
        rates.push(Math.pow(current / previous, 1) - 1);
      }
    }

    const averageRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    
    // Annualize if requested (assuming monthly data)
    const annualized = annualize ? Math.pow(1 + averageRate, 12) - 1 : averageRate;

    return {
      periodRates: rates,
      averageRate,
      annualizedRate: annualized,
      totalGrowth: values[values.length - 1] - values[0],
      totalGrowthPercentage: values[0] !== 0 
        ? ((values[values.length - 1] - values[0]) / values[0]) * 100 
        : 0,
      volatility: this.calculateGrowthVolatility(rates)
    };
  }

  /**
   * Calculate growth volatility (standard deviation of growth rates)
   */
  calculateGrowthVolatility(rates) {
    if (rates.length < 2) return 0;
    
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rates.length;
    return Math.sqrt(variance);
  }

  /**
   * Predict future values based on growth trends
   */
  predictFutureValues(values, periods, method = 'linear') {
    if (values.length < 2) return null;

    const predictions = [];
    
    if (method === 'linear') {
      // Simple linear regression
      const x = Array.from({ length: values.length }, (_, i) => i);
      const y = values;
      
      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
      const sumXX = x.reduce((a, b) => a + b * b, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      for (let i = 1; i <= periods; i++) {
        const nextX = values.length - 1 + i;
        predictions.push({
          period: i,
          predicted: slope * nextX + intercept,
          confidence: this.calculatePredictionConfidence(values, slope, intercept)
        });
      }
    } else if (method === 'growth') {
      // Growth-based prediction
      const growthRate = this.calculateGrowthRates(values).averageRate;
      let lastValue = values[values.length - 1];
      
      for (let i = 1; i <= periods; i++) {
        lastValue = lastValue * (1 + growthRate);
        predictions.push({
          period: i,
          predicted: lastValue,
          confidence: 70 // Lower confidence for growth-based predictions
        });
      }
    }

    return predictions;
  }

  /**
   * Calculate R-squared for prediction confidence
   */
  calculatePredictionConfidence(values, slope, intercept) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    const ssRes = values.reduce((a, b, i) => {
      const predicted = slope * i + intercept;
      return a + Math.pow(b - predicted, 2);
    }, 0);
    
    const ssTot = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    
    const rSquared = 1 - (ssRes / ssTot);
    return Math.max(0, Math.min(100, rSquared * 100));
  }

  /**
   * Detect growth patterns
   */
  detectGrowthPattern(values) {
    if (values.length < 4) return 'insufficient_data';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstGrowth = this.calculateGrowthRates(firstHalf).averageRate;
    const secondGrowth = this.calculateGrowthRates(secondHalf).averageRate;

    if (secondGrowth > firstGrowth * 1.5) return 'accelerating';
    if (secondGrowth < firstGrowth * 0.5) return 'decelerating';
    if (Math.abs(secondGrowth) < 0.05) return 'plateauing';
    
    return 'steady';
  }
}

module.exports = new GrowthCalculator();