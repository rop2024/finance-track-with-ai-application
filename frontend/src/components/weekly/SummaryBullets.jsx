import React from 'react';
import styles from './SummaryBullets.module.css';

const SummaryBullets = ({ bullets }) => {
  if (!bullets) return null;

  return (
    <div className={styles.bullets}>
      <div className={styles.overview}>
        <p className={styles.overviewText}>{bullets.overview}</p>
      </div>

      <div className={styles.metrics}>
        <h3>Key Metrics</h3>
        <ul className={styles.metricsList}>
          {bullets.keyMetrics.map((metric, index) => (
            <li key={index}>{metric}</li>
          ))}
        </ul>
      </div>

      {bullets.highlights.length > 0 && (
        <div className={styles.highlights}>
          <h3>✓ Highlights</h3>
          <ul>
            {bullets.highlights.map((highlight, index) => (
              <li key={index}>{highlight}</li>
            ))}
          </ul>
        </div>
      )}

      {bullets.lowlights.length > 0 && (
        <div className={styles.lowlights}>
          <h3>⚠ Areas for Attention</h3>
          <ul>
            {bullets.lowlights.map((lowlight, index) => (
              <li key={index}>{lowlight}</li>
            ))}
          </ul>
        </div>
      )}

      {bullets.insights.length > 0 && (
        <div className={styles.insights}>
          <h3>💡 Insights</h3>
          <ul>
            {bullets.insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SummaryBullets;