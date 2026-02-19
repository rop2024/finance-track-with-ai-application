const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['need', 'want', 'saving', 'fixed', 'income'],
    index: true
  },
  icon: {
    type: String,
    default: 'default-icon'
  },
  color: {
    type: String,
    default: '#808080'
  },
  isSystem: {
    type: Boolean,
    default: false,
    description: 'System categories cannot be deleted'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  monthlyBudget: {
    type: Number,
    min: 0
  },
  metadata: {
    description: String,
    tags: [String]
  },
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

// Ensure unique category name per user
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);