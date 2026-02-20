class InsightFilter {
  constructor() {
    this.maxInsights = 5;
    this.minConfidence = 70;
    this.priorityOrder = { high: 3, medium: 2, low: 1 };
  }

  /**
   * Filter and rank insights
   */
  filterInsights(rawInsights, metrics, shifts) {
    let insights = [...rawInsights];

    // Apply confidence threshold
    insights = insights.filter(i => i.confidence >= this.minConfidence);

    // Remove low-signal noise
    insights = this.removeNoise(insights, metrics);

    // Prioritize by significance
    insights = this.prioritizeInsights(insights, shifts);

    // Ensure diversity of types
    insights = this.ensureDiversity(insights);

    // Limit to max insights
    insights = insights.slice(0, this.maxInsights);

    // Add IDs if missing
    insights = insights.map((insight, index) => ({
      ...insight,
      id: insight.id || `${index + 1}`
    }));

    return insights;
  }

  /**
   * Remove low-signal noise (insights that aren't meaningful)
   */
  removeNoise(insights, metrics) {
    return insights.filter(insight => {
      // Check if insight has significant impact
      if (insight.impact?.amount && Math.abs(insight.impact.amount) < 10) {
        return false; // Too small to matter
      }

      if (insight.impact?.percentage && Math.abs(insight.impact.percentage) < 5) {
        return false; // Too small percentage change
      }

      // Check if insight is about normal variation
      if (insight.type === 'spending' && insight.confidence < 80) {
        // Low confidence spending insights are probably noise
        return false;
      }

      // Check if insight duplicates metrics we already track
      if (this.isRedundantInsight(insight, metrics)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if insight is redundant with metrics
   */
  isRedundantInsight(insight, metrics) {
    // If it's just stating the obvious (e.g., "you spent money this week")
    if (insight.title.toLowerCase().includes('spent') && 
        !insight.title.includes('significantly')) {
      return true;
    }

    // If it's just repeating a metric without insight
    if (insight.description.length < 30 && !insight.impact) {
      return true;
    }

    return false;
  }

  /**
   * Prioritize insights based on significance
   */
  prioritizeInsights(insights, shifts) {
    // Create map of shift significance
    const shiftMap = {};
    shifts.forEach(shift => {
      shiftMap[shift.metric] = shift.significance;
    });

    // Score each insight
    const scoredInsights = insights.map(insight => {
      let score = 0;

      // Base score from priority
      score += this.priorityOrder[insight.priority] || 1;

      // Boost if related to significant shift
      if (insight.type === 'spending' && shiftMap.expenses === 'high') score += 2;
      if (insight.type === 'savings' && shiftMap.savings === 'high') score += 2;
      if (insight.type === 'income' && shiftMap.income === 'high') score += 2;

      // Boost for high confidence
      score += (insight.confidence - 70) / 10;

      // Boost for actionable insights
      if (insight.actionItems && insight.actionItems.length > 0) {
        score += 1;
      }

      return { ...insight, score };
    });

    // Sort by score and return
    return scoredInsights
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...insight }) => insight);
  }

  /**
   * Ensure diversity of insight types
   */
  ensureDiversity(insights) {
    const typeCount = {};
    const diversified = [];

    for (const insight of insights) {
      const type = insight.type;
      
      // Limit to 2 per type
      if (!typeCount[type]) {
        typeCount[type] = 0;
      }

      if (typeCount[type] < 2) {
        diversified.push(insight);
        typeCount[type]++;
      }
    }

    return diversified;
  }

  /**
   * Generate summary sections from insights
   */
  generateSummarySections(insights) {
    const summary = {
      highlights: [],
      lowlights: [],
      neutral: []
    };

    insights.forEach(insight => {
      if (insight.impact?.direction === 'positive') {
        summary.highlights.push(insight.title);
      } else if (insight.impact?.direction === 'negative') {
        summary.lowlights.push(insight.title);
      } else {
        summary.neutral.push(insight.title);
      }
    });

    return summary;
  }

  /**
   * Get top insight
   */
  getTopInsight(insights) {
    if (insights.length === 0) return null;
    
    // Return highest priority insight
    return insights.sort((a, b) => 
      this.priorityOrder[b.priority] - this.priorityOrder[a.priority]
    )[0];
  }

  /**
   * Create overview sentence
   */
  createOverview(metrics, insights) {
    const parts = [];

    if (metrics.savings.rate > 20) {
      parts.push(`Strong savings rate of ${metrics.savings.rate.toFixed(1)}%`);
    } else if (metrics.savings.rate < 0) {
      parts.push(`Spending exceeded income by $${Math.abs(metrics.savings.total).toFixed(2)}`);
    } else if (metrics.savings.rate < 10) {
      parts.push(`Modest savings rate of ${metrics.savings.rate.toFixed(1)}%`);
    }

    if (metrics.expenses.change > 20) {
      parts.push(`with expenses up ${metrics.expenses.change.toFixed(1)}% from last week`);
    } else if (metrics.expenses.change < -20) {
      parts.push(`with expenses down ${Math.abs(metrics.expenses.change).toFixed(1)}% from last week`);
    }

    if (insights.length > 0) {
      const topInsight = this.getTopInsight(insights);
      if (topInsight) {
        parts.push(`. Key observation: ${topInsight.title.toLowerCase()}`);
      }
    }

    return parts.join(' ') || 'Financial activity this week was typical';
  }

  /**
   * Filter out low-confidence insights
   */
  filterByConfidence(insights, threshold = 70) {
    return insights.filter(i => i.confidence >= threshold);
  }

  /**
   * Rank insights by importance
   */
  rankInsights(insights) {
    return insights
      .map(insight => ({
        ...insight,
        rank: this.calculateRank(insight)
      }))
      .sort((a, b) => b.rank - a.rank)
      .map(({ rank, ...insight }) => insight);
  }

  /**
   * Calculate importance rank
   */
  calculateRank(insight) {
    let rank = 0;

    // Financial impact
    if (insight.impact?.amount) {
      rank += Math.min(10, Math.log10(Math.abs(insight.impact.amount)) * 2);
    }

    // Confidence
    rank += (insight.confidence - 50) / 10;

    // Priority
    rank += this.priorityOrder[insight.priority] * 2;

    // Actionability
    if (insight.actionItems?.length > 0) {
      rank += 2;
    }

    return rank;
  }
}

module.exports = new InsightFilter();