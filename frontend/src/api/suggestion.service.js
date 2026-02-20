import client from './client';

const SUGGESTIONS_URL = '/suggestions';

export const suggestionService = {
  // Get all suggestions
  getSuggestions: async (filters = {}) => {
    const params = { ...filters };
    return client.get(SUGGESTIONS_URL, { params });
  },

  // Get suggestion by ID
  getSuggestion: async (id) => {
    return client.get(`${SUGGESTIONS_URL}/${id}`);
  },

  // Approve suggestion
  approveSuggestion: async (id, modifications = {}) => {
    return client.post(`${SUGGESTIONS_URL}/${id}/approve`, modifications);
  },

  // Reject suggestion
  rejectSuggestion: async (id, reason = '') => {
    return client.post(`${SUGGESTIONS_URL}/${id}/reject`, { reason });
  },

  // Provide feedback
  provideFeedback: async (id, feedback) => {
    return client.post(`${SUGGESTIONS_URL}/${id}/feedback`, feedback);
  },

  // Dismiss suggestion
  dismissSuggestion: async (id) => {
    return client.patch(`${SUGGESTIONS_URL}/${id}/dismiss`);
  },

  // Get suggestion stats
  getStats: async () => {
    return client.get(`${SUGGESTIONS_URL}/stats`);
  },

  // Get learning preferences
  getLearningPreferences: async () => {
    return client.get('/learning/preferences');
  },

  // Update learning preferences
  updateLearningPreferences: async (preferences) => {
    return client.patch('/learning/preferences', preferences);
  }
};