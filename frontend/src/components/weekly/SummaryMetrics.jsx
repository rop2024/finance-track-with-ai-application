import React from 'react';

const SummaryMetrics = ({ metrics }) => {
  return (
    <div>
      <p>Total Spent: ${metrics.totalSpent}</p>
      <p>Budget Remaining: ${metrics.remaining}</p>
    </div>
  );
};

export default SummaryMetrics;