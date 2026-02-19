class ClusteringCalculator {
  /**
   * Detect spending clusters based on transaction patterns
   */
  detectSpendingClusters(transactions, options = {}) {
    const {
      minClusterSize = 3,
      amountThreshold = 0.5, // 50% deviation
      timeWindow = 7 // days
    } = options;

    if (transactions.length < minClusterSize) return [];

    // Sort by date
    const sorted = [...transactions].sort((a, b) => a.date - b.date);
    
    const clusters = [];
    let currentCluster = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      
      // Check if transactions are within time window
      const daysDiff = (current.date - previous.date) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= timeWindow) {
        currentCluster.push(current);
      } else {
        if (currentCluster.length >= minClusterSize) {
          clusters.push(this.analyzeCluster(currentCluster));
        }
        currentCluster = [current];
      }
    }

    // Check last cluster
    if (currentCluster.length >= minClusterSize) {
      clusters.push(this.analyzeCluster(currentCluster));
    }

    return clusters;
  }

  /**
   * Analyze a single cluster of transactions
   */
  analyzeCluster(cluster) {
    const amounts = cluster.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = this.calculateStdDev(amounts, mean);
    
    return {
      size: cluster.length,
      startDate: cluster[0].date,
      endDate: cluster[cluster.length - 1].date,
      duration: (cluster[cluster.length - 1].date - cluster[0].date) / (1000 * 60 * 60 * 24),
      totalAmount: amounts.reduce((a, b) => a + b, 0),
      averageAmount: mean,
      stdDev,
      coefficientOfVariation: mean > 0 ? stdDev / mean : 0,
      transactions: cluster.map(t => ({
        id: t._id,
        amount: t.amount,
        date: t.date,
        description: t.description
      })),
      pattern: this.identifyPattern(cluster)
    };
  }

  /**
   * Identify pattern within cluster
   */
  identifyPattern(cluster) {
    if (cluster.length < 2) return 'single';

    // Check for recurring amounts
    const amounts = cluster.map(t => t.amount);
    const uniqueAmounts = new Set(amounts);
    
    if (uniqueAmounts.size === 1) return 'fixed_amount';
    
    // Check for increasing/decreasing trend
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < cluster.length; i++) {
      if (cluster[i].amount > cluster[i-1].amount) increasing++;
      if (cluster[i].amount < cluster[i-1].amount) decreasing++;
    }
    
    if (increasing > decreasing * 2) return 'increasing_trend';
    if (decreasing > increasing * 2) return 'decreasing_trend';
    
    // Check for periodic pattern
    if (this.isPeriodic(cluster)) return 'periodic';
    
    return 'variable';
  }

  /**
   * Check if transactions follow a periodic pattern
   */
  isPeriodic(cluster) {
    if (cluster.length < 3) return false;
    
    const intervals = [];
    for (let i = 1; i < cluster.length; i++) {
      const interval = (cluster[i].date - cluster[i-1].date) / (1000 * 60 * 60 * 24);
      intervals.push(interval);
    }
    
    // Check if intervals are consistent
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = this.calculateStdDev(intervals, mean);
    
    return stdDev / mean < 0.2; // Less than 20% variation
  }

  /**
   * Detect outlier clusters
   */
  detectOutliers(clusters, threshold = 2) {
    if (clusters.length < 2) return [];

    const amounts = clusters.map(c => c.totalAmount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = this.calculateStdDev(amounts, mean);

    return clusters.filter(cluster => 
      Math.abs(cluster.totalAmount - mean) > threshold * stdDev
    );
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values, mean) {
    if (values.length < 2) return 0;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Find similar spending patterns
   */
  findSimilarPatterns(cluster, allClusters, similarityThreshold = 0.8) {
    return allClusters.filter(other => {
      if (other === cluster) return false;
      
      const similarity = this.calculateSimilarity(cluster, other);
      return similarity >= similarityThreshold;
    }).map(c => ({
      ...c,
      similarity: this.calculateSimilarity(cluster, c)
    }));
  }

  /**
   * Calculate similarity between two clusters
   */
  calculateSimilarity(cluster1, cluster2) {
    // Compare amount patterns
    const amount1 = cluster1.averageAmount;
    const amount2 = cluster2.averageAmount;
    const amountSimilarity = 1 - Math.abs(amount1 - amount2) / Math.max(amount1, amount2);
    
    // Compare duration
    const duration1 = cluster1.duration;
    const duration2 = cluster2.duration;
    const durationSimilarity = 1 - Math.abs(duration1 - duration2) / Math.max(duration1, duration2);
    
    // Compare size
    const sizeSimilarity = 1 - Math.abs(cluster1.size - cluster2.size) / Math.max(cluster1.size, cluster2.size);
    
    // Weighted average
    return (amountSimilarity * 0.5 + durationSimilarity * 0.3 + sizeSimilarity * 0.2);
  }
}

module.exports = new ClusteringCalculator();