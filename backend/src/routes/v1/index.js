const express = require('express');
const router = express.Router();

// Import routes
const authRoutes = require('./auth.routes');
const transactionRoutes = require('./transaction.routes');
const ingestionRoutes = require('./ingestion.routes');
const budgetRoutes = require('./budget.routes');
const aiRoutes = require('./ai.routes');
const analysisRoutes = require('./analysis.routes');
const learningRoutes = require('./learning.routes');
const suggestionRoutes = require('./suggestion.routes');
const weeklyRoutes = require('./weekly.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/ingestion', ingestionRoutes);
router.use('/budgets', budgetRoutes);
router.use('/ai', aiRoutes);
router.use('/analysis', analysisRoutes);
router.use('/learning', learningRoutes);
router.use('/suggestions', suggestionRoutes);
router.use('/weekly', weeklyRoutes);

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
      ai: '/api/v1/ai',
      analysis: '/api/v1/analysis',
      learning: '/api/v1/learning',
      suggestions: '/api/v1/suggestions',
      weekly: '/api/v1/weekly'
    }
  });
});

module.exports = router;