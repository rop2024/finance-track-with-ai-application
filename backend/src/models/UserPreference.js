const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  suggestionPreferences: {
    types: {
      budget_adjustment: {
        weight: { type: Number, default: 1.0, min: 0, max: 2 },
        acceptedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        lastShown: Date,
        lastAction: Date,
        cooldown: { type: Number, default: 7 } // days
      },
      savings_increase: {
        weight: { type: Number, default: 1.0, min: 0, max: 2 },
        acceptedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        lastShown: Date,
        lastAction: Date,
        cooldown: { type: Number, default: 14 }
      },
      subscription_cancellation: {
        weight: { type: Number, default: 1.0, min: 0, max: 2 },
        acceptedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        lastShown: Date,
        lastAction: Date,
        cooldown: { type: Number, default: 30 }
      },
      category_creation: {
        weight: { type: Number, default: 1.0, min: 0, max: 2 },
        acceptedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        lastShown: Date,
        lastAction: Date,
        cooldown: { type: Number, default: 14 }
      },
      budget_creation: {
        weight: { type: Number, default: 1.0, min: 0, max: 2 },
        acceptedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        lastShown: Date,
        lastAction: Date,
        cooldown: { type: Number, default: 14 }
      },
      goal_adjustment: {
        weight: { type: Number, default: 1.0, min: 0, max: 2 },
        acceptedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        lastShown: Date,
        lastAction: Date,
        cooldown: { type: Number, default: 30 }
      }
    },
    global: {
      totalSuggestionsShown: { type: Number, default: 0 },
      totalAccepted: { type: Number, default: 0 },
      totalRejected: { type: Number, default: 0 },
      acceptanceRate: { type: Number, default: 0 },
      lastActive: Date,
      suggestionFrequency: {
        type: String,
        enum: ['low', 'medium', 'high', 'adaptive'],
        default: 'adaptive'
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        start: String, // HH:mm format
        end: String
      }
    }
  },
  categoryPreferences: {
    type: Map,
    of: new mongoose.Schema({
      weight: { type: Number, default: 1.0, min: 0, max: 2 },
      acceptedCount: { type: Number, default: 0 },
      rejectedCount: { type: Number, default: 0 },
      lastSuggested: Date,
      lastAction: Date,
      typicalAmount: Number,
      volatility: Number
    }, { _id: false }),
    default: {}
  },
  timePreferences: {
    bestTimeToSuggest: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'weekend', 'adaptive'],
      default: 'adaptive'
    },
    dayOfWeekWeights: {
      monday: { type: Number, default: 1.0 },
      tuesday: { type: Number, default: 1.0 },
      wednesday: { type: Number, default: 1.0 },
      thursday: { type: Number, default: 1.0 },
      friday: { type: Number, default: 1.0 },
      saturday: { type: Number, default: 1.0 },
      sunday: { type: Number, default: 1.0 }
    },
    responseTimeByHour: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  impactPreferences: {
    minSavingsAmount: { type: Number, default: 10 },
    maxRiskTolerance: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    preferredTimeframes: [{
      type: String,
      enum: ['immediate', 'short_term', 'long_term']
    }]
  },
  metadata: {
    lastUpdated: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
    learningEnabled: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Method to update acceptance rate
userPreferenceSchema.methods.updateAcceptanceRate = function() {
  const total = this.suggestionPreferences.global.totalAccepted + 
                this.suggestionPreferences.global.totalRejected;
  if (total > 0) {
    this.suggestionPreferences.global.acceptanceRate = 
      (this.suggestionPreferences.global.totalAccepted / total) * 100;
  }
  return this;
};

module.exports = mongoose.model('UserPreference', userPreferenceSchema);