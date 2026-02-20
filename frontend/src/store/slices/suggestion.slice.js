import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { suggestionService } from '../../api/suggestion.service';

export const fetchSuggestions = createAsyncThunk(
  'suggestions/fetch',
  async (filters = {}, { rejectWithValue }) => {
    try {
      return await suggestionService.getSuggestions(filters);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const approveSuggestion = createAsyncThunk(
  'suggestions/approve',
  async ({ id, modifications }, { rejectWithValue, dispatch }) => {
    try {
      const response = await suggestionService.approveSuggestion(id, modifications);
      dispatch(fetchSuggestions({ status: 'pending' }));
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const rejectSuggestion = createAsyncThunk(
  'suggestions/reject',
  async ({ id, reason }, { rejectWithValue, dispatch }) => {
    try {
      const response = await suggestionService.rejectSuggestion(id, reason);
      dispatch(fetchSuggestions({ status: 'pending' }));
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const provideFeedback = createAsyncThunk(
  'suggestions/feedback',
  async ({ id, feedback }, { rejectWithValue }) => {
    try {
      return await suggestionService.provideFeedback(id, feedback);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const dismissSuggestion = createAsyncThunk(
  'suggestions/dismiss',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      await suggestionService.dismissSuggestion(id);
      dispatch(fetchSuggestions({}));
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSuggestionStats = createAsyncThunk(
  'suggestions/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      return await suggestionService.getStats();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  suggestions: [],
  stats: null,
  selectedSuggestion: null,
  loading: false,
  error: null,
  filters: {
    status: 'pending',
    type: null
  }
};

const suggestionSlice = createSlice({
  name: 'suggestions',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setSelectedSuggestion: (state, action) => {
      state.selectedSuggestion = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch suggestions
      .addCase(fetchSuggestions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSuggestions.fulfilled, (state, action) => {
        state.loading = false;
        state.suggestions = action.payload;
      })
      .addCase(fetchSuggestions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch stats
      .addCase(fetchSuggestionStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      // Approve suggestion
      .addCase(approveSuggestion.fulfilled, (state) => {
        state.selectedSuggestion = null;
      });
  }
});

export const { setFilters, setSelectedSuggestion, clearError } = suggestionSlice.actions;
export default suggestionSlice.reducer;