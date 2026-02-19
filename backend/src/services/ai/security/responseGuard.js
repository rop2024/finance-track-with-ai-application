class ResponseGuard {
  constructor() {
    this.maxInsights = 10;
    this.maxActionItems = 3;
    this.maxDataReferences = 5;
    this.minConfidence = 0;
    this.maxConfidence = 100;
    this.suspiciousPatterns = [
      /\b(?:credit card|ccv|pin|password)\b/i,
      /\b\d{16}\b/, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/ // SSN
    ];
  }

  /**
   * Guard AI response before returning to client
   */
  guardResponse(response) {
    if (!response) {
      throw new Error('Empty response from AI');
    }

    // Deep clone to avoid mutation
    const guarded = JSON.parse(JSON.stringify(response));

    // Apply guards
    this.limitInsights(guarded);
    this.validateConfidence(guarded);
    this.checkSuspiciousContent(guarded);
    this.ensureActionable(guarded);
    this.sanitizeText(guarded);
    this.addGuardMetadata(guarded);

    return guarded;
  }

  /**
   * Limit number of insights
   */
  limitInsights(response) {
    if (response.insights && response.insights.length > this.maxInsights) {
      // Keep highest confidence insights
      response.insights = response.insights
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.maxInsights);
    }

    if (response.integratedInsights && response.integratedInsights.length > this.maxInsights) {
      response.integratedInsights = response.integratedInsights
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.maxInsights);
    }
  }

  /**
   * Validate confidence scores
   */
  validateConfidence(response) {
    const validate = (item) => {
      if (item.confidence !== undefined) {
        // Clamp to valid range
        item.confidence = Math.max(this.minConfidence, 
          Math.min(this.maxConfidence, item.confidence));
        
        // Round to integer
        item.confidence = Math.round(item.confidence);
      }
    };

    if (response.insights) {
      response.insights.forEach(validate);
    }

    if (response.integratedInsights) {
      response.integratedInsights.forEach(validate);
    }
  }

  /**
   * Check for suspicious content
   */
  checkSuspiciousContent(response) {
    const str = JSON.stringify(response);
    
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(str)) {
        throw new Error(`Response contains suspicious pattern: ${pattern}`);
      }
    }
  }

  /**
   * Ensure insights are actionable
   */
  ensureActionable(response) {
    if (response.insights) {
      response.insights = response.insights.filter(insight => {
        // Must have at least one action item
        if (!insight.actionItems || insight.actionItems.length === 0) {
          return false;
        }

        // Action items must have descriptions
        const validActions = insight.actionItems.every(
          action => action.description && action.description.length >= 5
        );

        if (!validActions) return false;

        // Limit action items
        if (insight.actionItems.length > this.maxActionItems) {
          insight.actionItems = insight.actionItems.slice(0, this.maxActionItems);
        }

        return true;
      });
    }
  }

  /**
   * Sanitize text fields
   */
  sanitizeText(response) {
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;

      return str
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/[\\$;|&]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    };

    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach(item => traverse(item));
      } else {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string') {
            obj[key] = sanitizeString(obj[key]);
          } else if (typeof obj[key] === 'object') {
            traverse(obj[key]);
          }
        });
      }
    };

    traverse(response);
  }

  /**
   * Add guard metadata
   */
  addGuardMetadata(response) {
    response._guarded = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      stats: this.generateStats(response)
    };
  }

  /**
   * Generate response statistics
   */
  generateStats(response) {
    const stats = {
      totalInsights: 0,
      avgConfidence: 0,
      byPriority: { high: 0, medium: 0, low: 0 }
    };

    const insights = response.insights || response.integratedInsights || [];
    
    if (insights.length > 0) {
      stats.totalInsights = insights.length;
      
      const confidences = insights.map(i => i.confidence);
      stats.avgConfidence = confidences.reduce((a, b) => a + b, 0) / insights.length;
      
      insights.forEach(i => {
        if (stats.byPriority[i.priority] !== undefined) {
          stats.byPriority[i.priority]++;
        }
      });
    }

    return stats;
  }

  /**
   * Validate data references exist
   */
  validateDataReferences(response) {
    if (!response.insights) return true;

    for (const insight of response.insights) {
      // Check data references
      if (insight.dataReferences) {
        for (const ref of insight.dataReferences) {
          if (!ref.name || ref.value === undefined) {
            return false;
          }
        }
      }

      // Check action items have parameters if needed
      if (insight.actionItems) {
        for (const action of insight.actionItems) {
          if (action.type === 'adjust_budget' && !action.parameters?.suggestedAmount) {
            return false;
          }
          if (action.type === 'increase_savings' && !action.parameters?.suggestedAmount) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Add confidence disclaimer if needed
   */
  addConfidenceDisclaimer(response) {
    const lowConfidenceInsights = (response.insights || [])
      .filter(i => i.confidence < 70);

    if (lowConfidenceInsights.length > 0) {
      response._disclaimer = `Some insights have lower confidence (${lowConfidenceInsights.length} below 70%). Please review before taking action.`;
    }

    return response;
  }

  /**
   * Ensure monetary values are reasonable
   */
  validateMonetaryValues(response) {
    const MAX_AMOUNT = 1000000; // $1M max

    const checkValue = (value, path) => {
      if (typeof value === 'number' && Math.abs(value) > MAX_AMOUNT) {
        throw new Error(`Suspicious monetary value at ${path}: $${value}`);
      }
    };

    const traverse = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => traverse(item, `${path}[${i}]`));
      } else {
        Object.keys(obj).forEach(key => {
          const newPath = path ? `${path}.${key}` : key;
          
          if (key === 'amount' || key === 'value' || key === 'total') {
            checkValue(obj[key], newPath);
          }
          
          if (typeof obj[key] === 'object') {
            traverse(obj[key], newPath);
          }
        });
      }
    };

    traverse(response);
  }
}

module.exports = new ResponseGuard();