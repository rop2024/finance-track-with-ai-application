const express = require('express');
const router = express.Router();

// Import versioned routes
const authRoutes = require('./v1/auth.routes');
const transactionRoutes = require('./v1/transaction.routes');
const ingestionRoutes = require('./v1/ingestion.routes');
const budgetRoutes = require('./v1/budget.routes');
const aiRoutes = require('./v1/ai.routes');

// API version prefix
router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/ingestion', ingestionRoutes);
router.use('/budgets', budgetRoutes);
router.use('/ai', aiRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Financial Management API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      transactions: '/api/v1/transactions',
      ingestion: '/api/v1/ingestion',
      budgets: '/api/v1/budgets',
      ai: '/api/v1/ai'
    }
  });
});

module.exports = router;