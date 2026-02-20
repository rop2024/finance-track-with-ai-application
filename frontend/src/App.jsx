import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';

// Layout
import Layout from './components/common/Layout/Layout';

// Auth
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import PrivateRoute from './components/auth/PrivateRoute';

// Main screens
import Dashboard from './components/dashboard/Dashboard';
import TransactionsList from './components/transactions/TransactionsList';
import BudgetsList from './components/budgets/BudgetsList';
import SubscriptionsList from './components/subscriptions/SubscriptionsList';
import SuggestionsInbox from './components/suggestions/SuggestionsInbox';
import WeeklySummary from './components/weekly/WeeklySummary';
import Settings from './components/settings/Settings';

// Styles
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected routes */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="transactions" element={<TransactionsList />} />
            <Route path="budgets" element={<BudgetsList />} />
            <Route path="subscriptions" element={<SubscriptionsList />} />
            <Route path="suggestions" element={<SuggestionsInbox />} />
            <Route path="weekly" element={<WeeklySummary />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/:tab" element={<Settings />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;