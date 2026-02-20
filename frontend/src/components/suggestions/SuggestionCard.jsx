import React from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import styles from './SuggestionCard.module.css';

const SuggestionCard = ({ suggestion, isSelected, onClick }) => {
  const getTypeIcon = (type) => {
    const icons = {
      budget_adjustment: '📊',
      savings_increase: '💰',
      subscription_cancellation: '🔄',
      category_creation: '🏷️',
      budget_creation: '📋',
      goal_adjustment: '🎯'
    };
    return icons[type] || '💡';
  };

  const getPriorityClass = (priority) => {
    return styles[`priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`];
  };

  const getImpactColor = (impact) => {
    if (!impact) return '';
    if (impact.type === 'positive') return styles.impactPositive;
    if (impact.type === 'negative') return styles.impactNegative;
    return styles.impactNeutral;
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <span className={styles.icon}>{getTypeIcon(suggestion.type)}</span>
        <span className={`${styles.priority} ${getPriorityClass(suggestion.priority)}`}>
          {suggestion.priority}
        </span>
      </div>

      <h3 className={styles.title}>{suggestion.title}</h3>
      <p className={styles.description}>{suggestion.description}</p>

      {suggestion.estimatedImpact && (
        <div className={`${styles.impact} ${getImpactColor(suggestion.estimatedImpact)}`}>
          <span className={styles.impactLabel}>Estimated Impact:</span>
          {suggestion.estimatedImpact.amount && (
            <span className={styles.impactValue}>
              {formatCurrency(suggestion.estimatedImpact.amount)}
            </span>
          )}
          {suggestion.estimatedImpact.percentage && (
            <span className={styles.impactValue}>
              {suggestion.estimatedImpact.percentage > 0 ? '+' : ''}
              {suggestion.estimatedImpact.percentage}%
            </span>
          )}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.confidence}>
          Confidence: {suggestion.confidence}%
        </span>
        <span className={styles.date}>
          {formatDate(suggestion.createdAt)}
        </span>
      </div>

      {suggestion.status === 'pending' && (
        <div className={styles.actions}>
          <button className="btn-primary btn-sm">Review</button>
        </div>
      )}
    </div>
  );
};

export default SuggestionCard;