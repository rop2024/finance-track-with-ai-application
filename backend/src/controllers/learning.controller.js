const FeedbackProcessor = require('../services/learning/feedback.processor');
const WeightAdjuster = require('../services/learning/weight.adjuster');
const FrequencyController = require('../services/learning/frequency.controller');
const PreferenceManager = require('../services/learning/preference.manager');
const RulesEngine = require('../services/learning/rules.engine');
const LearningValidator = require('../services/learning/validators/learning.validator');
const { asyncHandler, ServiceError } = require('../middleware/errorHandler');

/**
 * Process user feedback on suggestion
 */
const processFeedback = asyncHandler(async (req, res) => {
  const { suggestionId } = req.params;
  const { decision, reasons, context, modifications } = req.body;

  // Validate feedback
  const validation = LearningValidator.validateFeedback({
    decision,
    reasons,
    context
  });

  if (!validation.isValid) {
    throw new ServiceError('Invalid feedback data', 400, validation.errors);
  }

  const feedback = await FeedbackProcessor.processDecision(
    suggestionId,
    req.userId,
    decision,
    {
      ...context,
      reasons,
      modifications
    }
  );

  res.json({
    success: true,
    data: feedback
  });
});

/**
 * Get user's learning profile
 */
const getLearningProfile = asyncHandler(async (req, res) => {
  const profile = await PreferenceManager.getUserProfile(req.userId);

  res.json({
    success: true,
    data: profile
  });
});

/**
 * Update user preferences
 */
const updatePreferences = asyncHandler(async (req, res) => {
  const { path, value } = req.body;

  const validation = LearningValidator.validatePreferenceUpdate(req.userId, { [path]: value });
  if (!validation.isValid) {
    throw new ServiceError('Invalid preference update', 400, validation.errors);
  }

  const updated = await PreferenceManager.updatePreference(req.userId, path, value);

  res.json({
    success: true,
    data: updated
  });
});

/**
 * Get category preferences
 */
const getCategoryPreferences = asyncHandler(async (req, res) => {
  const preferences = await PreferenceManager.getCategoryPreferences(req.userId);

  res.json({
    success: true,
    data: preferences
  });
});

/**
 * Update category preference
 */
const updateCategoryPreference = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const updates = req.body;

  const validation = LearningValidator.validateCategoryPreference({
    categoryId,
    ...updates
  });

  if (!validation.isValid) {
    throw new ServiceError('Invalid category preference', 400, validation.errors);
  }

  const updated = await PreferenceManager.updateCategoryPreference(
    req.userId,
    categoryId,
    updates
  );

  res.json({
    success: true,
    data: updated
  });
});

/**
 * Get suggestion preferences
 */
const getSuggestionPreferences = asyncHandler(async (req, res) => {
  const preferences = await PreferenceManager.getSuggestionPreferences(req.userId);

  res.json({
    success: true,
    data: preferences
  });
});

/**
 * Update suggestion type preference
 */
const updateSuggestionTypePreference = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const updates = req.body;

  const updated = await PreferenceManager.updateSuggestionTypePreference(
    req.userId,
    type,
    updates
  );

  res.json({
    success: true,
    data: updated
  });
});

/**
 * Get decision patterns
 */
const getDecisionPatterns = asyncHandler(async (req, res) => {
  const patterns = await FeedbackProcessor.getDecisionPatterns(req.userId);

  res.json({
    success: true,
    data: patterns
  });
});

/**
 * Manually adjust weights
 */
const adjustWeights = asyncHandler(async (req, res) => {
  const adjustments = await WeightAdjuster.adjustWeights(req.userId);

  res.json({
    success: true,
    data: adjustments
  });
});

/**
 * Reset all preferences
 */
const resetPreferences = asyncHandler(async (req, res) => {
  const newPrefs = await PreferenceManager.resetPreferences(req.userId);

  res.json({
    success: true,
    data: newPrefs,
    message: 'Preferences reset to default'
  });
});

/**
 * Get learning insights
 */
const getLearningInsights = asyncHandler(async (req, res) => {
  const insights = await RulesEngine.getLearningInsights(req.userId);

  res.json({
    success: true,
    data: insights
  });
});

/**
 * Export preferences
 */
const exportPreferences = asyncHandler(async (req, res) => {
  const exportData = await PreferenceManager.exportPreferences(req.userId);

  res.json({
    success: true,
    data: exportData
  });
});

/**
 * Import preferences
 */
const importPreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;

  if (!preferences) {
    throw new ServiceError('Preference data required', 400);
  }

  const imported = await PreferenceManager.importPreferences(req.userId, preferences);

  res.json({
    success: true,
    data: imported,
    message: 'Preferences imported successfully'
  });
});

/**
 * Get frequency recommendations
 */
const getFrequencyRecommendations = asyncHandler(async (req, res) => {
  const userPrefs = await UserPreference.findOne({ userId: req.userId });
  
  if (!userPrefs) {
    throw new ServiceError('User preferences not found', 404);
  }

  const recommendations = FrequencyController.getFrequencyRecommendation(userPrefs);

  res.json({
    success: true,
    data: recommendations
  });
});

/**
 * Update quiet hours
 */
const updateQuietHours = asyncHandler(async (req, res) => {
  const { enabled, start, end } = req.body;

  await PreferenceManager.updatePreference(
    req.userId,
    'suggestionPreferences.global.quietHours',
    { enabled, start, end }
  );

  res.json({
    success: true,
    message: 'Quiet hours updated'
  });
});

/**
 * Evaluate rule for suggestion
 */
const evaluateSuggestion = asyncHandler(async (req, res) => {
  const { suggestion } = req.body;

  const evaluation = await RulesEngine.evaluateSuggestion(req.userId, suggestion);

  res.json({
    success: true,
    data: evaluation
  });
});

module.exports = {
  processFeedback,
  getLearningProfile,
  updatePreferences,
  getCategoryPreferences,
  updateCategoryPreference,
  getSuggestionPreferences,
  updateSuggestionTypePreference,
  getDecisionPatterns,
  adjustWeights,
  resetPreferences,
  getLearningInsights,
  exportPreferences,
  importPreferences,
  getFrequencyRecommendations,
  updateQuietHours,
  evaluateSuggestion
};