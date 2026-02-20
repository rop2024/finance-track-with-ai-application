import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { weeklyService } from '../../api/weekly.service';

export const fetchSummaries = createAsyncThunk(
  'weekly/fetchSummaries',
  async (limit = 10, { rejectWithValue }) => {
    try {
      return await weeklyService.getSummaries(limit);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchLatestSummary = createAsyncThunk(
  'weekly/fetchLatest',
  async (_, { rejectWithValue }) => {
    try {
      return await weeklyService.getLatestSummary();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSummaryBullets = createAsyncThunk(
  'weekly/fetchBullets',
  async (_, { rejectWithValue }) => {
    try {
      return await weeklyService.getBullets();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTrends = createAsyncThunk(
  'weekly/fetchTrends',
  async (weeks = 8, { rejectWithValue }) => {
    try {
      return await weeklyService.getTrends(weeks);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const generateSummary = createAsyncThunk(
  'weekly/generate',
  async (force = false, { rejectWithValue, dispatch }) => {
    try {
      const response = await weeklyService.generateSummary(force);
      dispatch(fetchLatestSummary());
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAsViewed = createAsyncThunk(
  'weekly/markViewed',
  async (id, { rejectWithValue }) => {
    try {
      return await weeklyService.markAsViewed(id);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  summaries: [],
  currentSummary: null,
  bullets: null,
  trends: null,
  loading: false,
  error: null,
  hasUnviewed: false
};

const weeklySlice = createSlice({
  name: 'weekly',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch summaries
      .addCase(fetchSummaries.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSummaries.fulfilled, (state, action) => {
        state.loading = false;
        state.summaries = action.payload;
        state.hasUnviewed = action.payload.some(s => s.status === 'generated');
      })
      .addCase(fetchSummaries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch latest
      .addCase(fetchLatestSummary.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLatestSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSummary = action.payload;
      })
      .addCase(fetchLatestSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch bullets
      .addCase(fetchSummaryBullets.fulfilled, (state, action) => {
        state.bullets = action.payload;
      })
      // Fetch trends
      .addCase(fetchTrends.fulfilled, (state, action) => {
        state.trends = action.payload;
      })
      // Mark as viewed
      .addCase(markAsViewed.fulfilled, (state, action) => {
        if (state.currentSummary?._id === action.payload._id) {
          state.currentSummary.status = 'viewed';
        }
        state.hasUnviewed = false;
      });
  }
});

export const { clearError } = weeklySlice.actions;
export default weeklySlice.reducer;