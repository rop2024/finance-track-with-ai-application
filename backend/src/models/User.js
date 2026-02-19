const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  preferences: {
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD']
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'ja']
    },
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: false },
      budgetAlerts: { type: Boolean, default: true },
      subscriptionReminders: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'system']
    },
    monthlyBudgetStartDay: {
      type: Number,
      default: 1,
      min: 1,
      max: 31
    }
  },
  aiFeedbackHistory: [{
    suggestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AISuggestion'
    },
    feedback: {
      type: String,
      enum: ['helpful', 'not_helpful', 'irrelevant', 'implemented'],
      required: true
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);