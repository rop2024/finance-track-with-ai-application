import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSuggestions,
  setFilters,
  setSelectedSuggestion
} from '../../store/slices/suggestion.slice';
import SuggestionCard from './SuggestionCard';
import SuggestionDetails from './SuggestionDetails';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import styles from './SuggestionsInbox.module.css';

const SuggestionsInbox = () => {
  const dispatch = useDispatch();
  const { suggestions, loading, filters, stats } = useSelector(
    (state) => state.suggestions
  );
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    dispatch(fetchSuggestions(filters));
  }, [dispatch, filters]);

  const handleFilterChange = (newFilters) => {
    dispatch(setFilters(newFilters));
  };

  const handleSelectSuggestion = (suggestion) => {
    setSelectedId(suggestion._id);
    dispatch(setSelectedSuggestion(suggestion));
  };

  const handleCloseDetails = () => {
    setSelectedId(null);
    dispatch(setSelectedSuggestion(null));
  };

  const filterTabs = [
    { key: 'pending', label: 'Pending', count: stats?.pending || 0 },
    { key: 'approved', label: 'Approved', count: stats?.approved || 0 },
    { key: 'rejected', label: 'Rejected', count: stats?.rejected || 0 },
    { key: 'all', label: 'All', count: stats?.total || 0 }
  ];

  if (loading && suggestions.length === 0) {
    return <LoadingSpinner />;
  }

  const selectedSuggestion = suggestions.find(s => s._id === selectedId);

  return (
    <div className={styles.inbox}>
      <header className={styles.header}>
        <h1>Suggestions Inbox</h1>
        <p className={styles.subtitle}>
          Review and manage AI-powered financial suggestions
        </p>
      </header>

      <div className={styles.filters}>
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.filterTab} ${
              filters.status === tab.key ? styles.active : ''
            }`}
            onClick={() => handleFilterChange({ status: tab.key })}
          >
            {tab.label}
            {tab.count > 0 && <span className={styles.count}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className={styles.mainContent}>
        <div className={styles.suggestionsList}>
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion._id}
                suggestion={suggestion}
                isSelected={selectedId === suggestion._id}
                onClick={() => handleSelectSuggestion(suggestion)}
              />
            ))
          ) : (
            <EmptyState
              title="No suggestions"
              message={`No ${filters.status} suggestions at the moment`}
              icon="📭"
            />
          )}
        </div>

        {selectedSuggestion && (
          <div className={styles.detailsPanel}>
            <SuggestionDetails
              suggestion={selectedSuggestion}
              onClose={handleCloseDetails}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsInbox;