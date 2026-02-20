import client from './client';

const TRANSACTIONS_URL = '/transactions';

export const transactionService = {
  // Get all transactions with filters
  getTransactions: async (filters = {}, pagination = {}) => {
    const params = { ...filters, ...pagination };
    return client.get(TRANSACTIONS_URL, { params });
  },

  // Get single transaction
  getTransaction: async (id) => {
    return client.get(`${TRANSACTIONS_URL}/${id}`);
  },

  // Create transaction
  createTransaction: async (data) => {
    return client.post(TRANSACTIONS_URL, data);
  },

  // Bulk create transactions
  bulkCreateTransactions: async (transactions) => {
    return client.post(`${TRANSACTIONS_URL}/bulk`, transactions);
  },

  // Update transaction
  updateTransaction: async (id, data) => {
    return client.put(`${TRANSACTIONS_URL}/${id}`, data);
  },

  // Delete transaction
  deleteTransaction: async (id) => {
    return client.delete(`${TRANSACTIONS_URL}/${id}`);
  },

  // Import CSV
  importCSV: async (file, mapping = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (mapping) {
      formData.append('mapping', JSON.stringify(mapping));
    }

    return client.post(`${TRANSACTIONS_URL}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Preview CSV
  previewCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return client.post(`${TRANSACTIONS_URL}/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Get categories
  getCategories: async () => {
    return client.get('/categories');
  },

  // Create category
  createCategory: async (data) => {
    return client.post('/categories', data);
  },

  // Update category
  updateCategory: async (id, data) => {
    return client.put(`/categories/${id}`, data);
  },

  // Delete category
  deleteCategory: async (id) => {
    return client.delete(`/categories/${id}`);
  }
};