const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const weeklyController = require('../../controllers/weekly.controller');

// All weekly routes require authentication
router.use(authenticate);

// Summary listing and retrieval
router.get('/', weeklyController.getSummaries);
router.get('/latest', weeklyController.getLatestSummary);
router.get('/trends', weeklyController.getSummaryTrends);
router.get('/bullets', weeklyController.getSummaryBullets);
router.get('/stats', weeklyController.getSummaryStats);
router.get('/:id', weeklyController.getSummaryById);

// Generation (on-demand)
router.post('/generate', weeklyController.generateSummary);

// Admin routes
router.get('/admin/stats', weeklyController.getGenerationStats);
router.post('/admin/retry', weeklyController.retryFailed);

module.exports = router;