import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import styles from './SummaryInsights.module.css';

const SummaryInsights = ({ insights }) => {
  const getTypeIcon = (type) => {
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
    return icons[type] || '💡';
  };

  const getPriorityClass = (priority) => {
    return styles[`priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`];
  };

  return (
    <div className={styles.insights}>
      {insights.map((insight, index) => (
        <div key={index} className={`${styles.insight} ${getPriorityClass(insight.priority)}`}>
          <div className={styles.insightHeader}>
            <span className={styles.insightIcon}>{getTypeIcon(insight.type)}</span>
            <span className={styles.insightType}>{insight.type}</span>
            <span className={styles.insightConfidence}>{insight.confidence}%</span>
          </div>

          <h4 className={styles.insightTitle}>{insight.title}</h4>
          <p className={styles.insightDescription}>{insight.description}</p>

          {insight.impact && (
            <div className={styles.insightImpact}>
              {insight.impact.amount && (
                <span className={styles.impactAmount}>
                  {formatCurrency(insight.impact.amount)}
                </span>
              )}
              {insight.impact.percentage && (
                <span className={styles.impactPercentage}>
                  {insight.impact.percentage > 0 ? '+' : ''}
                  {insight.impact.percentage}%
                </span>
              )}
              <span className={`${styles.impactDirection} ${styles[insight.impact.direction]}`}>
                {insight.impact.direction}
              </span>
            </div>
          )}

          {insight.actionItems && insight.actionItems.length > 0 && (
            <div className={styles.actionItems}>
              <span className={styles.actionLabel}>Suggested actions:</span>
              <ul>
                {insight.actionItems.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SummaryInsights;