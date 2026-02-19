const { body, param, query, validationResult } = require('express-validator');

const validateTransaction = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01, max: 1000000 }).withMessage('Amount must be between 0.01 and 1,000,000'),
  
  body('type')
    .notEmpty().withMessage('Transaction type is required')
    .isIn(['income', 'expense', 'transfer']).withMessage('Invalid transaction type'),
  
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 3, max: 200 }).withMessage('Description must be between 3 and 200 characters')
    .trim()
    .escape(),
  
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom(value => {
      const date = new Date(value);
      if (date > new Date()) {
        throw new Error('Date cannot be in the future');
      }
      return true;
    }),
  
  body('categoryId')
    .optional()
    .isMongoId().withMessage('Invalid category ID'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'other'])
    .withMessage('Invalid payment method'),
  
  body('merchant.name')
    .optional()
    .isLength({ max: 100 }).withMessage('Merchant name too long')
    .trim()
    .escape(),
  
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array')
    .custom(tags => tags.length <= 10).withMessage('Maximum 10 tags allowed'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Notes too long')
    .trim()
    .escape(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

const validateBulkTransactions = [
  body()
    .isArray().withMessage('Request body must be an array')
    .custom(transactions => transactions.length <= 1000).withMessage('Maximum 1000 transactions allowed'),
  
  body('*.amount')
    .notEmpty().withMessage('Amount is required for all transactions')
    .isFloat({ min: 0.01 }),
  
  body('*.type')
    .notEmpty().withMessage('Type is required for all transactions')
    .isIn(['income', 'expense', 'transfer']),
  
  body('*.description')
    .notEmpty().withMessage('Description is required for all transactions')
    .isLength({ min: 3, max: 200 }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

const validateTransactionId = [
  param('id')
    .isMongoId().withMessage('Invalid transaction ID'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

const validateQueryFilters = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
  
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format'),
  
  query('type')
    .optional()
    .isIn(['income', 'expense', 'transfer']).withMessage('Invalid transaction type'),
  
  query('minAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum amount must be positive'),
  
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Maximum amount must be positive'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateTransaction,
  validateBulkTransactions,
  validateTransactionId,
  validateQueryFilters
};