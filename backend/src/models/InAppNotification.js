const mongoose = require('mongoose');

const inAppNotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'new_suggestion',
      'suggestion_approved',
      'suggestion_rejected',
      'suggestion_applied',
      'suggestion_rolled_back',
      'suggestion_expiring',
      'suggestion_conflict',
      'suggestion_failed'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  action: {
    text: String,
    url: String
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days
  }
}, {
  timestamps: true
});

// Index for cleanup
inAppNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
inAppNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('InAppNotification', inAppNotificationSchema);