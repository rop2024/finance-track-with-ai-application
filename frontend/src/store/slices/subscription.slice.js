import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  subscriptions: [],
  loading: false,
  error: null,
};

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    setSubscriptions: (state, action) => {
      state.subscriptions = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setSubscriptions, setLoading, setError } = subscriptionSlice.actions;
export default subscriptionSlice.reducer;