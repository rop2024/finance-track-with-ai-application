const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD']
  },
  recurrence: {
    frequency: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    },
    customCron: String,
    billingDate: {
      type: Number,
      min: 1,
      max: 31,
      default: 1
    },
    nextBillingDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: Date
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'expired', 'trial'],
    default: 'active',
    index: true
  },
  trialEndsAt: Date,
  autoRenew: {
    type: Boolean,
    default: true
  },
  provider: {
    name: String,
    website: String,
    supportEmail: String,
    supportPhone: String
  },
  notes: String,
  lastBilledAt: Date,
  lastBilledAmount: Number,
  totalSpent: {
    type: Number,
    default: 0
  },
  billingHistory: [{
    date: Date,
    amount: Number,
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],
  reminders: {
    beforeBilling: {
      days: { type: Number, default: 3 },
      enabled: { type: Boolean, default: true }
    },
    onRenewal: {
      enabled: { type: Boolean, default: true }
    }
  },
  metadata: {
    contractUrl: String,
    accountNumber: String,
    tags: [String]
  }
}, {
  timestamps: true
});

// Index for finding upcoming bills
subscriptionSchema.index({ 'recurrence.nextBillingDate': 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);