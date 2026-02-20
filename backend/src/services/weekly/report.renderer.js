class ReportRenderer {
  /**
   * Render complete weekly summary
   */
  renderSummary(metrics, insights, shifts, weekStart, weekEnd) {
    // Filter and organize insights
    const filteredInsights = this.organizeInsights(insights);
    
    // Generate summary sections
    const summary = this.generateSummary(metrics, filteredInsights);

    return {
      weekStart,
      weekEnd,
      metrics: this.formatMetrics(metrics),
      insights: filteredInsights,
      significantShifts: this.formatShifts(shifts),
      summary,
      rendered: {
        overview: this.renderOverview(summary),
        bulletPoints: this.renderBulletPoints(filteredInsights),
        highlights: this.renderHighlights(filteredInsights),
        callToAction: this.renderCallToAction(filteredInsights)
      }
    };
  }

  /**
   * Format metrics for display
   */
  formatMetrics(metrics) {
    return {
      income: {
        total: this.formatCurrency(metrics.income.total),
        change: this.formatPercentage(metrics.income.change),
        trend: this.getTrendSymbol(metrics.income.change)
      },
      expenses: {
        total: this.formatCurrency(metrics.expenses.total),
        change: this.formatPercentage(metrics.expenses.change),
        trend: this.getTrendSymbol(metrics.expenses.change),
        topCategories: metrics.expenses.byCategory.slice(0, 3).map(c => ({
          name: c.categoryName,
          amount: this.formatCurrency(c.amount),
          percentage: this.formatPercentage(c.percentage)
        }))
      },
      savings: {
        total: this.formatCurrency(metrics.savings.total),
        rate: this.formatPercentage(metrics.savings.rate),
        change: this.formatPercentage(metrics.savings.change),
        trend: this.getTrendSymbol(metrics.savings.change)
      },
      budgets: {
        onTrack: metrics.budgets.onTrack,
        atRisk: metrics.budgets.atRisk,
        health: this.getBudgetHealth(metrics.budgets)
      },
      goals: {
        progress: this.formatPercentage(metrics.goals.progress),
        contributions: this.formatCurrency(metrics.goals.contributions)
      }
    };
  }

  /**
   * Format shifts for display
   */
  formatShifts(shifts) {
    return shifts.slice(0, 3).map(shift => ({
      description: shift.description,
      magnitude: this.formatPercentage(shift.magnitude),
      direction: shift.direction,
      icon: this.getShiftIcon(shift)
    }));
  }

  /**
   * Organize insights by category
   */
  organizeInsights(insights) {
    const organized = {
      spending: [],
      savings: [],
      budget: [],
      goal: [],
      warning: [],
      achievement: []
    };

    insights.forEach(insight => {
      if (organized[insight.type]) {
        organized[insight.type].push(insight);
      } else {
        organized.spending.push(insight); // Default
      }
    });

    // Flatten but keep order
    return [
      ...organized.achievement,
      ...organized.savings,
      ...organized.spending,
      ...organized.budget,
      ...organized.goal,
      ...organized.warning
    ];
  }

  /**
   * Generate summary sections
   */
  generateSummary(metrics, insights) {
    const highlights = [];
    const lowlights = [];
    const neutral = [];

    insights.forEach(insight => {
      if (insight.impact?.direction === 'positive') {
        highlights.push(insight.title);
      } else if (insight.impact?.direction === 'negative') {
        lowlights.push(insight.title);
      } else {
        neutral.push(insight.title);
      }
    });

    // Add metric-based highlights
    if (metrics.savings.rate > 20) {
      highlights.push(`Saved ${metrics.savings.rate.toFixed(1)}% of income`);
    }

    if (metrics.budgets.onTrack > metrics.budgets.atRisk) {
      highlights.push(`${metrics.budgets.onTrack} budgets on track`);
    }

    // Add metric-based lowlights
    if (metrics.savings.rate < 5) {
      lowlights.push(`Savings rate below 5%`);
    }

    if (metrics.budgets.exceeded > 0) {
      lowlights.push(`${metrics.budgets.exceeded} budgets exceeded`);
    }

    return {
      overview: this.createOverview(metrics, insights),
      topInsight: insights[0]?.title || 'No significant insights this week',
      highlights: highlights.slice(0, 3),
      lowlights: lowlights.slice(0, 2),
      neutral: neutral.slice(0, 2)
    };
  }

  /**
   * Create overview sentence
   */
  createOverview(metrics, insights) {
    const parts = [];

    if (metrics.savings.rate > 20) {
      parts.push(`Strong week with ${metrics.savings.rate.toFixed(1)}% savings rate`);
    } else if (metrics.savings.rate > 10) {
      parts.push(`Good week with ${metrics.savings.rate.toFixed(1)}% savings rate`);
    } else if (metrics.savings.rate > 0) {
      parts.push(`Positive week with ${metrics.savings.rate.toFixed(1)}% savings rate`);
    } else {
      parts.push(`Tight week with spending exceeding income by $${Math.abs(metrics.savings.total).toFixed(2)}`);
    }

    if (Math.abs(metrics.expenses.change) > 20) {
      const direction = metrics.expenses.change > 0 ? 'up' : 'down';
      parts.push(`and expenses ${direction} ${Math.abs(metrics.expenses.change).toFixed(0)}% from last week`);
    }

    if (insights.length > 0) {
      parts.push(`. ${insights[0].title}`);
    }

    return parts.join(' ');
  }

  /**
   * Render bullet points from insights
   */
  renderBulletPoints(insights) {
    return insights.map(insight => ({
      text: `• ${insight.title}: ${insight.description}`,
      type: insight.type,
      priority: insight.priority,
      icon: this.getInsightIcon(insight)
    }));
  }

  /**
   * Render highlights section
   */
  renderHighlights(insights) {
    const highlights = insights.filter(i => i.impact?.direction === 'positive');
    
    if (highlights.length === 0) {
      return ['No major highlights this week'];
    }

    return highlights.map(h => ({
      title: h.title,
      description: h.description,
      impact: h.impact
    }));
  }

  /**
   * Render call to action
   */
  renderCallToAction(insights) {
    const actionable = insights.filter(i => i.actionItems?.length > 0);
    
    if (actionable.length === 0) {
      return null;
    }

    return {
      title: 'Recommended Actions',
      items: actionable.slice(0, 2).map(i => ({
        insight: i.title,
        actions: i.actionItems
      }))
    };
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    if (amount === undefined || amount === null) return '$0.00';
    return `$${amount.toFixed(2)}`;
  }

  /**
   * Format percentage
   */
  formatPercentage(value) {
    if (value === undefined || value === null) return '0%';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  /**
   * Get trend symbol
   */
  getTrendSymbol(change) {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '◆';
  }

  /**
   * Get insight icon
   */
  getInsightIcon(insight) {
    const icons = {
      spending: '💰',
      savings: '🏦',
      budget: '📊',
      goal: '🎯',
      warning: '⚠️',
      achievement: '🏆',
      income: '💵',
      subscription: '🔄'
    };
    return icons[insight.type] || '📌';
  }

  /**
   * Get shift icon
   */
  getShiftIcon(shift) {
    if (shift.direction === 'up') return '⬆️';
    if (shift.direction === 'down') return '⬇️';
    return '➡️';
  }

  /**
   * Get budget health status
   */
  getBudgetHealth(budgets) {
    const total = budgets.onTrack + budgets.atRisk + budgets.exceeded;
    if (total === 0) return 'No active budgets';
    
    const score = (budgets.onTrack / total) * 100;
    if (score > 80) return 'Excellent';
    if (score > 60) return 'Good';
    if (score > 40) return 'Fair';
    return 'Needs attention';
  }
}

module.exports = new ReportRenderer();