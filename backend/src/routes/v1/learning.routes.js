const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const learningController = require('../../controllers/learning.controller');

// All learning routes require authentication
router.use(authenticate);

// Feedback processing
router.post('/feedback/:suggestionId', learningController.processFeedback);

// User profile and preferences
router.get('/profile', learningController.getLearningProfile);
router.patch('/preferences', learningController.updatePreferences);

// Category preferences
router.get('/categories', learningController.getCategoryPreferences);
router.patch('/categories/:categoryId', learningController.updateCategoryPreference);

// Suggestion type preferences
router.get('/suggestion-types', learningController.getSuggestionPreferences);
router.patch('/suggestion-types/:type', learningController.updateSuggestionTypePreference);

// Pattern analysis
router.get('/patterns', learningController.getDecisionPatterns);
router.get('/insights', learningController.getLearningInsights);

// Weight management
router.post('/weights/adjust', learningController.adjustWeights);
router.post('/reset', learningController.resetPreferences);

// Import/Export
router.get('/export', learningController.exportPreferences);
router.post('/import', learningController.importPreferences);

// Frequency control
router.get('/frequency', learningController.getFrequencyRecommendations);
router.patch('/quiet-hours', learningController.updateQuietHours);

// Rule evaluation
router.post('/evaluate', learningController.evaluateSuggestion);

module.exports = router;