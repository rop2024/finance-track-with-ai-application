const ManualIngestionService = require('../services/ingestion/manualIngestion.service');
const CSVIngestionService = require('../services/ingestion/csvIngestion.service');
const { asyncHandler, ServiceError } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/csv';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.userId}-${uniqueSuffix}.csv`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new ServiceError('Only CSV files are allowed', 400), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const manualService = new ManualIngestionService();
const csvService = new CSVIngestionService();

// Manual ingestion endpoints
const createTransaction = asyncHandler(async (req, res) => {
  const transaction = await manualService.createTransaction(req.body, req.userId);
  
  res.status(201).json({
    success: true,
    data: transaction
  });
});

const bulkCreateTransactions = asyncHandler(async (req, res) => {
  const result = await manualService.bulkCreateTransactions(req.body, req.userId);
  
  res.status(result.success ? 201 : 207).json({
    success: result.success,
    data: result
  });
});

const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await manualService.updateTransaction(
    req.params.id,
    req.body,
    req.userId
  );
  
  res.json({
    success: true,
    data: transaction
  });
});

const deleteTransaction = asyncHandler(async (req, res) => {
  await manualService.deleteTransaction(req.params.id, req.userId);
  
  res.json({
    success: true,
    message: 'Transaction deleted successfully'
  });
});

const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await manualService.getTransactionById(req.params.id, req.userId);
  
  res.json({
    success: true,
    data: transaction
  });
});

const getTransactions = asyncHandler(async (req, res) => {
  const { transactions, pagination } = await manualService.getUserTransactions(
    req.userId,
    req.query,
    {
      page: req.query.page,
      limit: req.query.limit
    }
  );
  
  res.json({
    success: true,
    data: transactions,
    pagination
  });
});

// CSV ingestion endpoints
const previewCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ServiceError('CSV file is required', 400);
  }

  const preview = await csvService.previewImport(req.file.path);
  
  // Clean up file after preview
  fs.unlink(req.file.path, (err) => {
    if (err) console.error('Error deleting preview file:', err);
  });

  res.json({
    success: true,
    data: preview
  });
});

const importCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ServiceError('CSV file is required', 400);
  }

  const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
  const result = await csvService.importTransactions(req.file.path, req.userId, mapping);
  
  // Clean up file after import
  fs.unlink(req.file.path, (err) => {
    if (err) console.error('Error deleting imported file:', err);
  });

  res.status(result.success ? 201 : 207).json({
    success: result.success,
    data: result
  });
});

const getCSVTemplate = asyncHandler(async (req, res) => {
  const headers = ['amount', 'type', 'description', 'date', 'category', 'paymentMethod', 'notes', 'tags', 'merchant'];
  const sampleRow = ['49.99', 'expense', 'Monthly subscription', '2024-01-15', 'Entertainment', 'credit_card', 'Netflix', 'streaming,entertainment', 'Netflix Inc.'];
  
  const csv = [headers.join(','), sampleRow.join(',')].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transaction-template.csv');
  res.send(csv);
});

module.exports = {
  // Manual
  createTransaction,
  bulkCreateTransactions,
  updateTransaction,
  deleteTransaction,
  getTransaction,
  getTransactions,
  
  // CSV
  previewCSV,
  importCSV,
  getCSVTemplate,
  
  // Upload middleware
  upload: upload.single('file')
};