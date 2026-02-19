/**
 * Strict validation rules for transaction data ingestion
 * Ensures data integrity before reaching database
 */
class TransactionValidator {
  static validateManualEntry(data) {
    const errors = [];

    // Required fields validation
    if (!data.amount) {
      errors.push('Amount is required');
    } else if (typeof data.amount !== 'number' || data.amount <= 0) {
      errors.push('Amount must be a positive number');
    } else if (data.amount > 1000000) {
      errors.push('Amount exceeds maximum limit of 1,000,000');
    }

    if (!data.type) {
      errors.push('Transaction type is required');
    } else if (!['income', 'expense', 'transfer'].includes(data.type)) {
      errors.push('Invalid transaction type');
    }

    if (!data.description) {
      errors.push('Description is required');
    } else if (data.description.length > 200) {
      errors.push('Description exceeds 200 characters');
    } else if (data.description.length < 3) {
      errors.push('Description must be at least 3 characters');
    }

    if (!data.date) {
      errors.push('Date is required');
    } else {
      const date = new Date(data.date);
      if (isNaN(date.getTime())) {
        errors.push('Invalid date format');
      } else if (date > new Date()) {
        errors.push('Date cannot be in the future');
      } else if (date < new Date('2000-01-01')) {
        errors.push('Date cannot be before year 2000');
      }
    }

    // Conditional validation
    if (data.type !== 'transfer' && !data.categoryId) {
      errors.push('Category is required for income/expense transactions');
    }

    // Optional fields validation
    if (data.merchant && typeof data.merchant === 'object') {
      if (data.merchant.name && data.merchant.name.length > 100) {
        errors.push('Merchant name exceeds 100 characters');
      }
    }

    if (data.paymentMethod && !['cash', 'credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'other'].includes(data.paymentMethod)) {
      errors.push('Invalid payment method');
    }

    if (data.tags && Array.isArray(data.tags)) {
      if (data.tags.length > 10) {
        errors.push('Maximum 10 tags allowed');
      }
      data.tags.forEach(tag => {
        if (tag.length > 30) {
          errors.push('Tag exceeds 30 characters');
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: this.sanitizeTransaction(data)
    };
  }

  static sanitizeTransaction(data) {
    const sanitized = { ...data };

    // Trim string fields
    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
    }

    if (sanitized.merchant?.name) {
      sanitized.merchant.name = sanitized.merchant.name.trim();
    }

    // Ensure amount is a number
    if (sanitized.amount) {
      sanitized.amount = parseFloat(sanitized.amount.toFixed(2));
    }

    // Remove HTML tags from string fields
    const stripHtml = (str) => str?.replace(/<[^>]*>?/gm, '') || str;
    sanitized.description = stripHtml(sanitized.description);
    sanitized.notes = stripHtml(sanitized.notes);

    return sanitized;
  }

  static validateBulkTransactions(transactions) {
    if (!Array.isArray(transactions)) {
      return {
        isValid: false,
        errors: ['Bulk data must be an array']
      };
    }

    if (transactions.length > 1000) {
      return {
        isValid: false,
        errors: ['Cannot process more than 1000 transactions at once']
      };
    }

    const results = transactions.map((t, index) => {
      const validation = this.validateManualEntry(t);
      return {
        index,
        ...validation
      };
    });

    const invalidCount = results.filter(r => !r.isValid).length;

    return {
      isValid: invalidCount === 0,
      totalProcessed: transactions.length,
      validCount: transactions.length - invalidCount,
      invalidCount,
      results
    };
  }
}

module.exports = TransactionValidator;