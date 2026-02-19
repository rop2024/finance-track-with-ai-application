const express = require('express');
const router = express.Router();
const { authenticate, checkResourceOwnership } = require('../../middleware/auth');
const { 
  validateTransaction,
  validateBulkTransactions,
  validateTransactionId,
  validateQueryFilters
} = require('../../middleware/validation');
const { csvUploadLimiter, ingestionLimiter } = require('../../middleware/rateLimiter');
const ingestionController = require('../../controllers/ingestion.controller');
const Transaction = require('../../models/Transaction');

// All ingestion routes require authentication
router.use(authenticate);

// CSV ingestion routes (with stricter limits)
router.post('/csv/preview', 
  csvUploadLimiter,
  ingestionController.upload,
  ingestionController.previewCSV
);

router.post('/csv/import',
  csvUploadLimiter,
  ingestionController.upload,
  ingestionController.importCSV
);

router.get('/csv/template',
  ingestionController.getCSVTemplate
);

// Manual ingestion routes
router.route('/transactions')
  .get(validateQueryFilters, ingestionController.getTransactions)
  .post(ingestionLimiter, validateTransaction, ingestionController.createTransaction);

router.post('/transactions/bulk',
  ingestionLimiter,
  validateBulkTransactions,
  ingestionController.bulkCreateTransactions
);

router.route('/transactions/:id')
  .get(validateTransactionId, checkResourceOwnership(Transaction), ingestionController.getTransaction)
  .put(validateTransactionId, validateTransaction, checkResourceOwnership(Transaction), ingestionController.updateTransaction)
  .delete(validateTransactionId, checkResourceOwnership(Transaction), ingestionController.deleteTransaction);

module.exports = router;