const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/rateLimiter');
const aiController = require('../../controllers/ai.controller');

// All AI routes require authentication and have strict rate limiting
router.use(authenticate);
router.use(aiLimiter);

// AI analysis endpoints
router.get('/analysis/spending-patterns', aiController.getSpendingPatterns);
router.get('/analysis/savings-opportunities', aiController.getSavingsOpportunities);
router.get('/analysis/budget-insights', aiController.getBudgetInsights);
router.get('/analysis/subscription-optimization', aiController.getSubscriptionOptimization);

// AI suggestions endpoints
router.get('/suggestions', aiController.getSuggestions);
router.post('/suggestions/:id/feedback', aiController.provideFeedback);
router.patch('/suggestions/:id/dismiss', aiController.dismissSuggestion);

// Predictive analysis
router.get('/predict/next-month', aiController.predictNextMonth);
router.get('/predict/category-trends', aiController.predictCategoryTrends);

// Anomaly detection
router.get('/anomalies', aiController.detectAnomalies);

module.exports = router;