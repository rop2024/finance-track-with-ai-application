const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { insightSchema, integratedAnalysisSchema } = require('./schemas/analysis.schema');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true
    });
    
    addFormats(this.ajv);
    
    // Compile schemas
    this.insightValidator = this.ajv.compile(insightSchema);
    this.integratedValidator = this.ajv.compile(integratedAnalysisSchema);
    
    // Custom formats
    this.ajv.addFormat('percentage', {
      type: 'number',
      validate: (value) => value >= 0 && value <= 100
    });
  }

  /**
   * Validate insight response
   */
  validateInsightResponse(response, type = 'single') {
    const validator = type === 'integrated' 
      ? this.integratedValidator 
      : this.insightValidator;

    const valid = validator(response);
    
    if (!valid) {
      return {
        isValid: false,
        errors: this.formatErrors(validator.errors),
        response
      };
    }

    // Additional validation
    const dataValidation = this.validateDataReferences(response);
    if (!dataValidation.isValid) {
      return dataValidation;
    }

    return {
      isValid: true,
      data: response
    };
  }

  /**
   * Validate data references exist
   */
  validateDataReferences(response) {
    const errors = [];

    if (response.insights) {
      response.insights.forEach((insight, index) => {
        // Check each data reference has valid values
        insight.dataReferences.forEach((ref, refIndex) => {
          if (ref.value === undefined || ref.value === null) {
            errors.push(`Insight ${index}: Data reference ${refIndex} missing value`);
          }
          if (ref.value === 0 && ref.type !== 'count') {
            // Zero might be valid, but note it
            console.warn(`Warning: Zero value in data reference: ${ref.type}.${ref.name}`);
          }
        });

        // Check confidence matches data quality
        if (insight.confidence > 90 && insight.dataReferences.length < 2) {
          errors.push(`Insight ${index}: High confidence (${insight.confidence}) with minimal data references`);
        }

        // Validate action items
        insight.actionItems.forEach((action, actionIndex) => {
          if (!action.description || action.description.length < 10) {
            errors.push(`Insight ${index}: Action item ${actionIndex} description too short`);
          }
        });
      });
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
        response
      };
    }

    return { isValid: true };
  }

  /**
   * Format AJV errors for readability
   */
  formatErrors(errors) {
    if (!errors) return [];

    return errors.map(error => {
      const path = error.instancePath || 'root';
      return {
        path,
        message: error.message,
        params: error.params
      };
    });
  }

  /**
   * Sanitize response to match schema (remove extra fields)
   */
  sanitizeToSchema(response, type = 'single') {
    const schema = type === 'integrated' ? integratedAnalysisSchema : insightSchema;
    
    const sanitized = {};
    
    // Only include fields defined in schema
    Object.keys(schema.properties).forEach(key => {
      if (response[key] !== undefined) {
        sanitized[key] = response[key];
      }
    });

    return sanitized;
  }

  /**
   * Check if response meets minimum quality standards
   */
  meetsQualityStandards(response) {
    if (!response.insights || response.insights.length === 0) {
      return false;
    }

    // At least one insight must have confidence > 70
    const hasHighConfidence = response.insights.some(i => i.confidence >= 70);
    if (!hasHighConfidence) {
      return false;
    }

    // All insights must have at least one action item
    const allHaveActions = response.insights.every(i => i.actionItems?.length > 0);
    if (!allHaveActions) {
      return false;
    }

    // All insights must reference data
    const allHaveData = response.insights.every(i => i.dataReferences?.length > 0);
    if (!allHaveData) {
      return false;
    }

    return true;
  }

  /**
   * Enforce confidence thresholds
   */
  filterByConfidence(response, threshold = 70) {
    return {
      ...response,
      insights: response.insights.filter(i => i.confidence >= threshold)
    };
  }

  /**
   * Validate numeric ranges
   */
  validateNumericRanges(response) {
    const issues = [];

    const checkRange = (value, min, max, field) => {
      if (value < min || value > max) {
        issues.push(`${field}: ${value} outside range [${min}, ${max}]`);
      }
    };

    if (response.insights) {
      response.insights.forEach((insight, i) => {
        checkRange(insight.confidence, 0, 100, `insight[${i}].confidence`);
        
        if (insight.impact?.amount) {
          // Impact amount shouldn't be unreasonably large (max $1M)
          checkRange(insight.impact.amount, 0, 1000000, `insight[${i}].impact.amount`);
        }
        
        if (insight.impact?.percentage) {
          checkRange(insight.impact.percentage, -1000, 1000, `insight[${i}].impact.percentage`);
        }
      });
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = new SchemaValidator();