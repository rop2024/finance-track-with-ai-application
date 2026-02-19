/**
 * Utility functions for mathematical operations used in analysis
 */
class MathUtils {
  /**
   * Calculate mean of array
   */
  static mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Calculate median of array
   */
  static median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate mode of array
   */
  static mode(arr) {
    const frequency = {};
    let maxFreq = 0;
    let modes = [];

    arr.forEach(value => {
      frequency[value] = (frequency[value] || 0) + 1;
      if (frequency[value] > maxFreq) {
        maxFreq = frequency[value];
        modes = [value];
      } else if (frequency[value] === maxFreq) {
        modes.push(value);
      }
    });

    return maxFreq > 1 ? modes : [];
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(arr) {
    if (arr.length < 2) return 0;
    const mean = this.mean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile
   */
  static percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sorted[lower];
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Detect outliers using IQR method
   */
  static detectOutliersIQR(arr, multiplier = 1.5) {
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;
    
    return arr.filter(value => value < lowerBound || value > upperBound);
  }

  /**
   * Calculate correlation coefficient
   */
  static correlation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  }

  /**
   * Calculate compound annual growth rate
   */
  static cagr(startValue, endValue, periods) {
    if (startValue === 0 || periods === 0) return 0;
    return Math.pow(endValue / startValue, 1 / periods) - 1;
  }

  /**
   * Calculate moving average
   */
  static movingAverage(arr, window) {
    const result = [];
    for (let i = window - 1; i < arr.length; i++) {
      const sum = arr.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
    return result;
  }

  /**
   * Calculate exponential moving average
   */
  static exponentialMovingAverage(arr, alpha) {
    const result = [];
    let ema = arr[0];
    
    result.push(ema);
    for (let i = 1; i < arr.length; i++) {
      ema = alpha * arr[i] + (1 - alpha) * ema;
      result.push(ema);
    }
    
    return result;
  }

  /**
   * Normalize array to [0, 1] range
   */
  static normalize(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;
    
    if (range === 0) return arr.map(() => 0.5);
    
    return arr.map(value => (value - min) / range);
  }

  /**
   * Calculate z-scores
   */
  static zScores(arr) {
    const mean = this.mean(arr);
    const std = this.standardDeviation(arr);
    
    if (std === 0) return arr.map(() => 0);
    
    return arr.map(value => (value - mean) / std);
  }

  /**
   * Calculate weighted average
   */
  static weightedAverage(values, weights) {
    if (values.length !== weights.length) {
      throw new Error('Values and weights must have same length');
    }
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;
    
    const weightedSum = values.reduce((sum, value, i) => sum + value * weights[i], 0);
    return weightedSum / totalWeight;
  }

  /**
   * Calculate rate of change
   */
  static rateOfChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  static volatility(arr) {
    if (arr.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < arr.length; i++) {
      returns.push((arr[i] - arr[i - 1]) / arr[i - 1]);
    }
    
    return this.standardDeviation(returns);
  }

  /**
   * Calculate Sharpe ratio (risk-adjusted return)
   */
  static sharpeRatio(returns, riskFreeRate = 0) {
    if (returns.length === 0) return 0;
    
    const avgReturn = this.mean(returns);
    const stdDev = this.standardDeviation(returns);
    
    if (stdDev === 0) return 0;
    
    return (avgReturn - riskFreeRate) / stdDev;
  }

  /**
   * Calculate maximum drawdown
   */
  static maxDrawdown(values) {
    let maxValue = values[0];
    let maxDrawdown = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxValue) {
        maxValue = values[i];
      }
      
      const drawdown = (maxValue - values[i]) / maxValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown * 100;
  }

  /**
   * Calculate confidence interval
   */
  static confidenceInterval(arr, confidence = 0.95) {
    const mean = this.mean(arr);
    const std = this.standardDeviation(arr);
    const n = arr.length;
    
    // Z-score for confidence level
    const zScores = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
    const z = zScores[confidence] || 1.96;
    
    const margin = z * (std / Math.sqrt(n));
    
    return {
      mean,
      lower: mean - margin,
      upper: mean + margin,
      margin
    };
  }
}

module.exports = MathUtils;