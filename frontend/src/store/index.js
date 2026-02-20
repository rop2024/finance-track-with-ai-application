import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/auth.slice';
import userReducer from './slices/user.slice';
import transactionReducer from './slices/transaction.slice';
import budgetReducer from './slices/budget.slice';
import subscriptionReducer from './slices/subscription.slice';
import suggestionReducer from './slices/suggestion.slice';
import weeklyReducer from './slices/weekly.slice';
import uiReducer from './slices/ui.slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    transactions: transactionReducer,
    budgets: budgetReducer,
    subscriptions: subscriptionReducer,
    suggestions: suggestionReducer,
    weekly: weeklyReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      thunk: true
    }),
  devTools: process.env.NODE_ENV !== 'production'
});

export default store;