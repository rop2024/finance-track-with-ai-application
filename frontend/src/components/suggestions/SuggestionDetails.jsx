import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  approveSuggestion,
  rejectSuggestion,
  provideFeedback
} from '../../store/slices/suggestion.slice';
import ApprovalModal from './ApprovalModal';
import FeedbackForm from './FeedbackForm';
import { formatCurrency, formatDate } from '../../utils/formatters';
import styles from './SuggestionDetails.module.css';

const SuggestionDetails = ({ suggestion, onClose }) => {
  const dispatch = useDispatch();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async (modifications = {}) => {
    await dispatch(approveSuggestion({
      id: suggestion._id,
      modifications
    }));
    setShowApprovalModal(false);
    onClose();
  };

  const handleReject = async () => {
    if (!rejectReason) return;
    await dispatch(rejectSuggestion({
      id: suggestion._id,
      reason: rejectReason
    }));
    setRejectReason('');
    onClose();
  };

  const handleFeedback = async (feedback) => {
    await dispatch(provideFeedback({
      id: suggestion._id,
      feedback
    }));
    setShowFeedbackForm(false);
  };

  const getStatusBadge = () => {
    const statusClasses = {
      pending: styles.statusPending,
      approved: styles.statusApproved,
      rejected: styles.statusRejected,
      applied: styles.statusApplied
    };
    
    return (
      <span className={`${styles.status} ${statusClasses[suggestion.status]}`}>
        {suggestion.status}
      </span>
    );
  };

  return (
    <div className={styles.details}>
      <div className={styles.header}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        <h2>Suggestion Details</h2>
        {getStatusBadge()}
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h3>Title</h3>
          <p className={styles.title}>{suggestion.title}</p>
        </div>

        <div className={styles.section}>
          <h3>Description</h3>
          <p className={styles.description}>{suggestion.description}</p>
        </div>

        {suggestion.estimatedImpact && (
          <div className={styles.section}>
            <h3>Estimated Impact</h3>
            <div className={styles.impact}>
              {suggestion.estimatedImpact.amount && (
                <div className={styles.impactItem}>
                  <span className={styles.impactLabel}>Amount:</span>
                  <span className={styles.impactValue}>
                    {formatCurrency(suggestion.estimatedImpact.amount)}
                  </span>
                </div>
              )}
              {suggestion.estimatedImpact.percentage && (
                <div className={styles.impactItem}>
                  <span className={styles.impactLabel}>Percentage:</span>
                  <span className={styles.impactValue}>
                    {suggestion.estimatedImpact.percentage}%
                  </span>
                </div>
              )}
              {suggestion.estimatedImpact.timeframe && (
                <div className={styles.impactItem}>
                  <span className={styles.impactLabel}>Timeframe:</span>
                  <span className={styles.impactValue}>
                    {suggestion.estimatedImpact.timeframe}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h3>Current State</h3>
          <pre className={styles.codeBlock}>
            {JSON.stringify(suggestion.currentState, null, 2)}
          </pre>
        </div>

        <div className={styles.section}>
          <h3>Proposed Changes</h3>
          <pre className={styles.codeBlock}>
            {JSON.stringify(suggestion.proposedChanges, null, 2)}
          </pre>
        </div>

        {suggestion.dataReferences && suggestion.dataReferences.length > 0 && (
          <div className={styles.section}>
            <h3>Data References</h3>
            <ul className={styles.references}>
              {suggestion.dataReferences.map((ref, index) => (
                <li key={index}>
                  {ref.type}: {ref.name} ({ref.value})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.metadata}>
          <div className={styles.metadataItem}>
            <span>Type:</span> {suggestion.type}
          </div>
          <div className={styles.metadataItem}>
            <span>Confidence:</span> {suggestion.confidence}%
          </div>
          <div className={styles.metadataItem}>
            <span>Priority:</span> {suggestion.priority}
          </div>
          <div className={styles.metadataItem}>
            <span>Created:</span> {formatDate(suggestion.createdAt)}
          </div>
          {suggestion.expiresAt && (
            <div className={styles.metadataItem}>
              <span>Expires:</span> {formatDate(suggestion.expiresAt)}
            </div>
          )}
        </div>
      </div>

      {suggestion.status === 'pending' && (
        <div className={styles.actions}>
          <button
            className="btn-primary"
            onClick={() => setShowApprovalModal(true)}
          >
            Approve
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowFeedbackForm(true)}
          >
            Provide Feedback
          </button>
          <button
            className="btn-danger"
            onClick={() => setShowFeedbackForm(true)}
          >
            Reject
          </button>
        </div>
      )}

      {showApprovalModal && (
        <ApprovalModal
          suggestion={suggestion}
          onApprove={handleApprove}
          onCancel={() => setShowApprovalModal(false)}
        />
      )}

      {showFeedbackForm && (
        <FeedbackForm
          suggestion={suggestion}
          onSubmit={handleFeedback}
          onCancel={() => setShowFeedbackForm(false)}
        />
      )}
    </div>
  );
};

export default SuggestionDetails;