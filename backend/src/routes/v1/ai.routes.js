const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/rateLimiter');
const aiController = require('../../controllers/ai.controller');

// All AI routes require authentication and have strict rate limiting
router.use(authenticate);
router.use(aiLimiter);

// Main insight generation
router.post('/insights/generate', aiController.generateInsights);
router.get('/insights/integrated', aiController.getIntegratedAnalysis);

// Specific insight types
router.get('/insights/spending', aiController.getSpendingInsights);
router.get('/insights/budget', aiController.getBudgetInsights);
router.get('/insights/savings', aiController.getSavingsInsights);
router.get('/insights/risks', aiController.getRiskInsights);

// Insight management
router.get('/insights', aiController.getUserInsights);
router.get('/insights/stats', aiController.getInsightStats);
router.get('/insights/:id', aiController.getInsightById);
router.post('/insights/:id/feedback', aiController.provideFeedback);
router.patch('/insights/:id/dismiss', aiController.dismissInsight);

// Legacy endpoints (redirect or maintain for backward compatibility)
router.get('/analysis/spending-patterns', aiController.getSpendingInsights);
router.get('/analysis/savings-opportunities', aiController.getSavingsInsights);
router.get('/analysis/budget-insights', aiController.getBudgetInsights);
router.get('/analysis/subscription-optimization', aiController.getRiskInsights);

// AI suggestions endpoints (maintain for backward compatibility)
router.get('/suggestions', aiController.getUserInsights);
router.post('/suggestions/:id/feedback', aiController.provideFeedback);
router.patch('/suggestions/:id/dismiss', aiController.dismissInsight);

module.exports = router;