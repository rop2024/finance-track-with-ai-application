const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimiter');
const analysisController = require('../../controllers/analysis.controller');

// All analysis routes require authentication
router.use(authenticate);
router.use(apiLimiter);

// Main analysis endpoints
router.get('/full', analysisController.getFullAnalysis);
router.get('/dashboard', analysisController.getDashboardSummary);
router.get('/aggregation', analysisController.getAggregation);
router.get('/patterns', analysisController.getPatterns);
router.get('/risks', analysisController.getRisks);

// Comparison endpoint
router.get('/compare', analysisController.comparePeriods);

// Category-specific analysis
router.get('/categories/:categoryId', analysisController.analyzeCategory);

// Signal management
router.get('/signals', analysisController.getSignals);
router.get('/signals/stats', analysisController.getSignalStats);
router.get('/signals/:id', analysisController.getSignalById);
router.patch('/signals/:id/status', analysisController.updateSignalStatus);

module.exports = router;