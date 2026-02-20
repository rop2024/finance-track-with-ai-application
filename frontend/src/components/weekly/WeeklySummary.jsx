import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchLatestSummary,
  fetchSummaryBullets,
  generateSummary,
  markAsViewed
} from '../../store/slices/weekly.slice';
import SummaryHeader from './SummaryHeader';
import SummaryMetrics from './SummaryMetrics';
import SummaryInsights from './SummaryInsights';
import SummaryBullets from './SummaryBullets';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import styles from './WeeklySummary.module.css';

const WeeklySummary = () => {
  const dispatch = useDispatch();
  const { currentSummary, bullets, loading } = useSelector(
    (state) => state.weekly
  );

  useEffect(() => {
    dispatch(fetchLatestSummary());
    dispatch(fetchSummaryBullets());
  }, [dispatch]);

  useEffect(() => {
    if (currentSummary && currentSummary.status === 'generated') {
      dispatch(markAsViewed(currentSummary._id));
    }
  }, [currentSummary, dispatch]);

  const handleGenerateNew = async () => {
    await dispatch(generateSummary(true));
  };

  if (loading && !currentSummary) {
    return <LoadingSpinner />;
  }

  if (!currentSummary) {
    return (
      <EmptyState
        title="No weekly summary yet"
        message="Generate your first weekly summary to see insights"
        actionLabel="Generate Summary"
        onAction={handleGenerateNew}
        icon="📊"
      />
    );
  }

  return (
    <div className={styles.weeklySummary}>
      <SummaryHeader
        weekStart={currentSummary.weekStart}
        weekEnd={currentSummary.weekEnd}
        onRefresh={handleGenerateNew}
      />

      <div className={styles.content}>
        <div className={styles.mainSection}>
          <SummaryMetrics metrics={currentSummary.metrics} />
          
          {bullets && (
            <SummaryBullets bullets={bullets} />
          )}
        </div>

        <div className={styles.insightsSection}>
          <h2>Key Insights</h2>
          <SummaryInsights insights={currentSummary.insights} />
        </div>
      </div>

      {currentSummary.significantShifts?.length > 0 && (
        <div className={styles.shifts}>
          <h3>Significant Changes</h3>
          <div className={styles.shiftsList}>
            {currentSummary.significantShifts.map((shift, index) => (
              <div key={index} className={styles.shiftItem}>
                <span className={styles.shiftIcon}>
                  {shift.direction === 'up' ? '⬆️' : '⬇️'}
                </span>
                <span className={styles.shiftDescription}>
                  {shift.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <button className="btn-secondary" onClick={handleGenerateNew}>
          Generate New Summary
        </button>
      </div>
    </div>
  );
};

export default WeeklySummary;