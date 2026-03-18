import React from 'react';

const FeedbackForm = ({ onSubmit }) => {
  return (
    <form onSubmit={onSubmit}>
      <textarea placeholder="Enter feedback..." />
      <button type="submit">Submit Feedback</button>
    </form>
  );
};

export default FeedbackForm;