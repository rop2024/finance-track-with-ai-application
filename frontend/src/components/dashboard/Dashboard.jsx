import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTransactions } from '../../store/slices/transaction.slice';
import { fetchBudgets } from '../../store/slices/budget.slice';
import { fetchSuggestions } from '../../store/slices/suggestion.slice';
import { fetchLatestSummary } from '../../store/slices/weekly.slice';

import OverviewCards from './OverviewCards';
import SpendingChart from './SpendingChart';
import BudgetProgress from './BudgetProgress';
import RecentTransactions from './RecentTransactions';
import QuickActions from './QuickActions';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';

import styles from './Dashboard.module.css';

const Dashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { transactions, loading: transactionsLoading } = useSelector(
    (state) => state.transactions
  );
  const { budgets } = useSelector((state) => state.budgets);
  const { suggestions } = useSelector((state) => state.suggestions);
  const { currentSummary } = useSelector((state) => state.weekly);

  useEffect(() => {
    dispatch(fetchTransactions({ limit: 10 }));
    dispatch(fetchBudgets());
    dispatch(fetchSuggestions({ status: 'pending', limit: 5 }));
    dispatch(fetchLatestSummary());
  }, [dispatch]);

  const pendingSuggestions = suggestions?.filter(s => s.status === 'pending') || [];

  if (transactionsLoading && transactions.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Welcome back, {user?.name?.split(' ')[0] || 'User'}</h1>
        {currentSummary && (
          <div className={styles.summaryBadge}>
            <span>📊 Week of {new Date(currentSummary.weekStart).toLocaleDateString()}</span>
          </div>
        )}
      </header>

      <OverviewCards />

      <div className={styles.mainGrid}>
        <div className={styles.chartSection}>
          <SpendingChart />
        </div>

        <div className={styles.budgetSection}>
          <BudgetProgress budgets={budgets} />
        </div>
      </div>

      <div className={styles.secondaryGrid}>
        <div className={styles.transactionsSection}>
          <h2>Recent Transactions</h2>
          {transactions.length > 0 ? (
            <RecentTransactions transactions={transactions.slice(0, 5)} />
          ) : (
            <EmptyState
              title="No transactions yet"
              message="Add your first transaction to start tracking"
              actionLabel="Add Transaction"
              onAction={() => {/* Navigate to add transaction */}}
            />
          )}
        </div>

        <div className={styles.suggestionsSection}>
          <h2>Pending Suggestions ({pendingSuggestions.length})</h2>
          {pendingSuggestions.length > 0 ? (
            <div className={styles.suggestionsList}>
              {pendingSuggestions.slice(0, 3).map((suggestion) => (
                <div key={suggestion._id} className={styles.suggestionItem}>
                  <h3>{suggestion.title}</h3>
                  <p>{suggestion.description}</p>
                  <div className={styles.suggestionActions}>
                    <button className="btn-primary btn-sm">Review</button>
                  </div>
                </div>
              ))}
              {pendingSuggestions.length > 3 && (
                <button className="btn-link">View all suggestions →</button>
              )}
            </div>
          ) : (
            <p className={styles.noSuggestions}>No pending suggestions</p>
          )}
        </div>
      </div>

      <QuickActions />
    </div>
  );
};

export default Dashboard;