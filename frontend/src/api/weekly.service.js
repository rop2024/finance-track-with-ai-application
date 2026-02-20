import client from './client';

const WEEKLY_URL = '/weekly';

export const weeklyService = {
  // Get all summaries
  getSummaries: async (limit = 10) => {
    return client.get(WEEKLY_URL, { params: { limit } });
  },

  // Get latest summary
  getLatestSummary: async () => {
    return client.get(`${WEEKLY_URL}/latest`);
  },

  // Get summary by ID
  getSummary: async (id) => {
    return client.get(`${WEEKLY_URL}/${id}`);
  },

  // Get summary in bullet format
  getBullets: async () => {
    return client.get(`${WEEKLY_URL}/bullets`);
  },

  // Get trends
  getTrends: async (weeks = 8) => {
    return client.get(`${WEEKLY_URL}/trends`, { params: { weeks } });
  },

  // Generate summary on demand
  generateSummary: async (force = false) => {
    return client.post(`${WEEKLY_URL}/generate`, { force });
  },

  // Mark summary as viewed
  markAsViewed: async (id) => {
    return client.patch(`${WEEKLY_URL}/${id}/view`);
  }
};