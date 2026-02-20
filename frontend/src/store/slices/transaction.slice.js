import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionService } from '../../api/transaction.service';

export const fetchTransactions = createAsyncThunk(
  'transactions/fetch',
  async ({ filters = {}, pagination = {} }, { rejectWithValue }) => {
    try {
      return await transactionService.getTransactions(filters, pagination);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/create',
  async (data, { rejectWithValue, dispatch }) => {
    try {
      const response = await transactionService.createTransaction(data);
      dispatch(fetchTransactions({}));
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateTransaction = createAsyncThunk(
  'transactions/update',
  async ({ id, data }, { rejectWithValue, dispatch }) => {
    try {
      const response = await transactionService.updateTransaction(id, data);
      dispatch(fetchTransactions({}));
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      await transactionService.deleteTransaction(id);
      dispatch(fetchTransactions({}));
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const importCSV = createAsyncThunk(
  'transactions/import',
  async ({ file, mapping }, { rejectWithValue, dispatch }) => {
    try {
      const response = await transactionService.importCSV(file, mapping);
      dispatch(fetchTransactions({}));
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'transactions/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      return await transactionService.getCategories();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  transactions: [],
  categories: [],
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  },
  filters: {},
  loading: false,
  error: null,
  importProgress: null
};

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = null;
    },
    setImportProgress: (state, action) => {
      state.importProgress = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload.transactions || [];
        state.pagination = action.payload.pagination || state.pagination;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch categories
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      // Import CSV
      .addCase(importCSV.pending, (state) => {
        state.loading = true;
        state.importProgress = 0;
      })
      .addCase(importCSV.fulfilled, (state) => {
        state.loading = false;
        state.importProgress = null;
      })
      .addCase(importCSV.rejected, (state, action) => {
        state.loading = false;
        state.importProgress = null;
        state.error = action.payload;
      });
  }
});

export const { setFilters, clearFilters, clearError, setImportProgress } = transactionSlice.actions;
export default transactionSlice.reducer;