import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import styles from './OverviewCards.module.css';

const OverviewCards = () => {
  const { transactions } = useSelector((state) => state.transactions);
  const { currentSummary } = useSelector((state) => state.weekly);
  
  const [metrics, setMetrics] = useState({
    income: 0,
    expenses: 0,
    savings: 0,
    savingsRate: 0
  });

  useEffect(() => {
    if (currentSummary?.metrics) {
      setMetrics({
        income: currentSummary.metrics.income.total,
        expenses: currentSummary.metrics.expenses.total,
        savings: currentSummary.metrics.savings.total,
        savingsRate: currentSummary.metrics.savings.rate
      });
    } else if (transactions.length > 0) {
      // Calculate from recent transactions if no summary
      const now = new Date();
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      
      const weeklyTransactions = transactions.filter(
        t => new Date(t.date) >= weekAgo
      );
      
      const income = weeklyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = weeklyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      setMetrics({
        income,
        expenses,
        savings: income - expenses,
        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0
      });
    }
  }, [currentSummary, transactions]);

  const cards = [
    {
      title: 'Income',
      value: formatCurrency(metrics.income),
      change: currentSummary?.metrics?.income?.change,
      icon: '💰',
      color: '#10b981'
    },
    {
      title: 'Expenses',
      value: formatCurrency(metrics.expenses),
      change: currentSummary?.metrics?.expenses?.change,
      icon: '💳',
      color: '#ef4444'
    },
    {
      title: 'Savings',
      value: formatCurrency(metrics.savings),
      change: currentSummary?.metrics?.savings?.change,
      icon: '🏦',
      color: '#3b82f6'
    },
    {
      title: 'Savings Rate',
      value: formatPercentage(metrics.savingsRate),
      change: currentSummary?.metrics?.savings?.rateChange,
      icon: '📈',
      color: '#8b5cf6'
    }
  ];

  return (
    <div className={styles.cards}>
      {cards.map((card, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.cardIcon} style={{ backgroundColor: `${card.color}20` }}>
            <span style={{ color: card.color }}>{card.icon}</span>
          </div>
          <div className={styles.cardContent}>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            <p className={styles.cardValue}>{card.value}</p>
            {card.change !== undefined && (
              <span className={`${styles.cardChange} ${
                card.change > 0 ? styles.positive : card.change < 0 ? styles.negative : ''
              }`}>
                {card.change > 0 ? '▲' : card.change < 0 ? '▼' : '◆'} 
                {Math.abs(card.change).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OverviewCards;