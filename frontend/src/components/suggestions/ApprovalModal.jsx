import React from 'react';

const ApprovalModal = ({ isOpen, onClose, onApprove, onReject }) => {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Approve Suggestion?</h3>
        <button onClick={onApprove}>Approve</button>
        <button onClick={onReject}>Reject</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default ApprovalModal;