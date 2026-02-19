class DataSanitizer {
  constructor() {
    this.sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // Credit card with dashes
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{10}\b/, // Phone (simple)
      /\baccount[_-]?number\b.*?\d+/i, // Account numbers
      /\bssn\b.*?\d+/i, // SSN references
    ];
  }

  /**
   * Sanitize data for AI consumption
   */
  sanitizeForAI(data) {
    if (!data) return data;

    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove PII fields
    this.removePIFFields(sanitized);

    // Aggregate transactions (remove individual transaction data)
    if (sanitized.transactions) {
      sanitized.transactionSummary = this.aggregateTransactions(sanitized.transactions);
      delete sanitized.transactions;
    }

    // Remove any remaining sensitive patterns
    this.scrubSensitivePatterns(sanitized);

    // Round numbers to 2 decimal places
    this.roundNumbers(sanitized);

    return sanitized;
  }

  /**
   * Remove PII fields recursively
   */
  removePIFFields(obj) {
    const piiFields = [
      'email', 'phone', 'address', 'city', 'state', 'zip',
      'ssn', 'taxId', 'accountNumber', 'routingNumber',
      'password', 'token', 'secret', 'apiKey',
      'firstName', 'lastName', 'fullName', 'birthDate',
      'ipAddress', 'userAgent'
    ];

    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => this.removePIFFields(item));
    } else {
      Object.keys(obj).forEach(key => {
        if (piiFields.includes(key.toLowerCase())) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          this.removePIFFields(obj[key]);
        }
      });
    }
  }

  /**
   * Aggregate transactions to summary level
   */
  aggregateTransactions(transactions) {
    if (!Array.isArray(transactions)) return {};

    const summary = {
      totalCount: transactions.length,
      totalAmount: 0,
      byCategory: {},
      byMonth: {},
      averageAmount: 0,
      dateRange: {
        earliest: null,
        latest: null
      }
    };

    transactions.forEach(t => {
      // Total amount
      summary.totalAmount += t.amount || 0;

      // By category
      const category = t.category || 'uncategorized';
      if (!summary.byCategory[category]) {
        summary.byCategory[category] = {
          count: 0,
          total: 0
        };
      }
      summary.byCategory[category].count++;
      summary.byCategory[category].total += t.amount;

      // By month
      if (t.date) {
        const month = t.date.substring(0, 7); // YYYY-MM
        summary.byMonth[month] = (summary.byMonth[month] || 0) + t.amount;

        // Date range
        if (!summary.dateRange.earliest || t.date < summary.dateRange.earliest) {
          summary.dateRange.earliest = t.date;
        }
        if (!summary.dateRange.latest || t.date > summary.dateRange.latest) {
          summary.dateRange.latest = t.date;
        }
      }
    });

    summary.averageAmount = summary.totalCount > 0 
      ? summary.totalAmount / summary.totalCount 
      : 0;

    return summary;
  }

  /**
   * Scrub sensitive patterns from strings
   */
  scrubSensitivePatterns(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => this.scrubSensitivePatterns(item));
    } else {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = this.scrubString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          this.scrubSensitivePatterns(obj[key]);
        }
      });
    }
  }

  /**
   * Scrub a single string
   */
  scrubString(str) {
    let scrubbed = str;
    
    this.sensitivePatterns.forEach(pattern => {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    });

    return scrubbed;
  }

  /**
   * Round numbers to 2 decimal places
   */
  roundNumbers(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => this.roundNumbers(item));
    } else {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'number') {
          obj[key] = Math.round(obj[key] * 100) / 100;
        } else if (typeof obj[key] === 'object') {
          this.roundNumbers(obj[key]);
        }
      });
    }
  }

  /**
   * Validate no sensitive data remains
   */
  validateSanitized(obj) {
    const str = JSON.stringify(obj);
    
    // Check for patterns that shouldn't be present
    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(str)) {
        return {
          isValid: false,
          pattern: pattern.toString()
        };
      }
    }

    // Check for PII field names
    const piiFields = ['email', 'phone', 'address', 'ssn'];
    for (const field of piiFields) {
      if (str.toLowerCase().includes(`"${field}"`)) {
        return {
          isValid: false,
          field
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Create anonymized user ID
   */
  anonymizeUserId(userId) {
    // Create a deterministic but non-reversible hash
    const hash = require('crypto')
      .createHash('sha256')
      .update(userId + process.env.ANONYMIZATION_SALT)
      .digest('hex')
      .substring(0, 16);
    
    return `user_${hash}`;
  }

  /**
   * Prepare data for AI analysis
   */
  prepareForAnalysis(data, userId) {
    const sanitized = this.sanitizeForAI(data);
    
    // Add anonymized user ID
    sanitized.userId = this.anonymizeUserId(userId);
    
    // Add metadata
    sanitized._metadata = {
      sanitizedAt: new Date().toISOString(),
      version: '1.0',
      dataQuality: this.assessDataQuality(data)
    };

    return sanitized;
  }

  /**
   * Assess data quality for AI analysis
   */
  assessDataQuality(data) {
    const metrics = {
      hasTransactions: !!(data.transactions?.length > 0),
      transactionCount: data.transactions?.length || 0,
      hasCategories: !!(data.categories?.length > 0),
      hasBudgets: !!(data.budgets?.length > 0),
      hasGoals: !!(data.goals?.length > 0),
      dateRange: this.calculateDateRange(data.transactions)
    };

    // Calculate quality score (0-100)
    let score = 0;
    if (metrics.hasTransactions) score += 40;
    if (metrics.hasCategories) score += 20;
    if (metrics.hasBudgets) score += 20;
    if (metrics.hasGoals) score += 20;

    // Bonus for sufficient data
    if (metrics.transactionCount >= 50) score += 20;
    if (metrics.transactionCount >= 20) score += 10;

    // Date range bonus
    if (metrics.dateRange.days >= 90) score += 20;
    if (metrics.dateRange.days >= 30) score += 10;

    return {
      score: Math.min(100, score),
      metrics
    };
  }

  /**
   * Calculate date range from transactions
   */
  calculateDateRange(transactions) {
    if (!transactions || transactions.length === 0) {
      return { days: 0, earliest: null, latest: null };
    }

    const dates = transactions
      .map(t => new Date(t.date))
      .filter(d => !isNaN(d));

    if (dates.length === 0) return { days: 0 };

    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    const days = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));

    return { days, earliest, latest };
  }
}

module.exports = new DataSanitizer();