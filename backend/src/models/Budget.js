const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
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
  period: {
    type: String,
    required: true,
    enum: ['weekly', 'monthly', 'yearly', 'custom'],
    index: true
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
  spent: {
    type: Number,
    default: 0,
    min: 0
  },
  flexibility: {
    type: String,
    enum: ['strict', 'flexible', 'rollover'],
    default: 'flexible',
    index: true
  },
  rolloverConfig: {
    maxRollover: {
      type: Number,
      default: null
    },
    resetDay: {
      type: Number,
      default: 1
    }
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  alerts: {
    enabled: { type: Boolean, default: true },
    threshold: { type: Number, default: 80, min: 0, max: 100 },
    notifiedAt: Date
  },
  notes: String,
  metadata: {
    template: Boolean,
    tags: [String]
  }
}, {
  timestamps: true
});

// Ensure one active budget per category per period
budgetSchema.index(
  { userId: 1, categoryId: 1, period: 1, startDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('Budget', budgetSchema);