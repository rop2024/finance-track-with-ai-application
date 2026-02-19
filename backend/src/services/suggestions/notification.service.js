const nodemailer = require('nodemailer');
const User = require('../../models/User');

class NotificationService {
  constructor() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    this.notificationChannels = {
      email: this.sendEmail.bind(this),
      push: this.sendPushNotification.bind(this),
      inApp: this.saveInAppNotification.bind(this)
    };
  }

  /**
   * Notify about new suggestion
   */
  async notifyNewSuggestion(suggestion) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'new_suggestion');

    for (const channel of channels) {
      try {
        await this.notificationChannels[channel]({
          type: 'new_suggestion',
          user,
          suggestion,
          title: `New Financial Suggestion: ${suggestion.title}`,
          message: suggestion.description,
          data: {
            suggestionId: suggestion._id,
            type: suggestion.type,
            impact: suggestion.estimatedImpact
          }
        });
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  /**
   * Notify about approved suggestion
   */
  async notifyApproved(suggestion) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_approved');

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_approved',
        user,
        suggestion,
        title: '✅ Suggestion Approved - Ready to Apply',
        message: `Your suggestion "${suggestion.title}" has been approved and is ready to apply.`,
        action: {
          text: 'Apply Now',
          url: `${process.env.APP_URL}/suggestions/${suggestion._id}/apply`
        },
        data: {
          suggestionId: suggestion._id,
          action: 'apply',
          expiresAt: suggestion.metadata.expiresAt
        }
      });
    }
  }

  /**
   * Notify about rejected suggestion
   */
  async notifyRejected(suggestion, reason) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_rejected');

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_rejected',
        user,
        suggestion,
        title: '❌ Suggestion Rejected',
        message: `Your suggestion "${suggestion.title}" has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        data: {
          suggestionId: suggestion._id,
          reason
        }
      });
    }
  }

  /**
   * Notify about applied suggestion
   */
  async notifyApplied(suggestion, result) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_applied');

    const impactMessage = result.data?.adjustment 
      ? ` Budget adjusted by $${Math.abs(result.data.adjustment)}`
      : result.data?.monthlySavings 
      ? ` Saving $${result.data.monthlySavings}/month`
      : '';

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_applied',
        user,
        suggestion,
        title: '✨ Suggestion Applied Successfully',
        message: `Your suggestion "${suggestion.title}" has been applied.${impactMessage}`,
        action: {
          text: 'View Changes',
          url: `${process.env.APP_URL}/suggestions/${suggestion._id}/result`
        },
        data: {
          suggestionId: suggestion._id,
          result
        }
      });
    }
  }

  /**
   * Notify about rollback
   */
  async notifyRolledBack(suggestion, reason) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_rolled_back');

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_rolled_back',
        user,
        suggestion,
        title: '↩️ Suggestion Changes Rolled Back',
        message: `The changes from "${suggestion.title}" have been rolled back.${reason ? ` Reason: ${reason}` : ''}`,
        data: {
          suggestionId: suggestion._id,
          reason
        }
      });
    }
  }

  /**
   * Notify about expiring suggestion
   */
  async notifyExpiring(suggestion, daysRemaining) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_expiring');

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_expiring',
        user,
        suggestion,
        title: '⏰ Suggestion Expiring Soon',
        message: `Your suggestion "${suggestion.title}" will expire in ${daysRemaining} days.`,
        action: {
          text: 'Review Now',
          url: `${process.env.APP_URL}/suggestions/${suggestion._id}`
        },
        data: {
          suggestionId: suggestion._id,
          daysRemaining,
          expiresAt: suggestion.metadata.expiresAt
        }
      });
    }
  }

  /**
   * Notify about conflict
   */
  async notifyConflict(suggestion) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_conflict');

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_conflict',
        user,
        suggestion,
        title: '⚠️ Suggestion Conflict Detected',
        message: `There is a conflict with "${suggestion.title}". Please review before proceeding.`,
        action: {
          text: 'Resolve Conflict',
          url: `${process.env.APP_URL}/suggestions/${suggestion._id}/conflict`
        },
        data: {
          suggestionId: suggestion._id,
          conflicts: suggestion.conflicts
        }
      });
    }
  }

  /**
   * Notify about failed application
   */
  async notifyFailed(suggestion, error) {
    const user = await User.findById(suggestion.userId);
    const channels = this.getUserChannels(user, 'suggestion_failed');

    for (const channel of channels) {
      await this.notificationChannels[channel]({
        type: 'suggestion_failed',
        user,
        suggestion,
        title: '❌ Suggestion Application Failed',
        message: `Failed to apply "${suggestion.title}". Error: ${error}`,
        action: {
          text: 'Try Again',
          url: `${process.env.APP_URL}/suggestions/${suggestion._id}/retry`
        },
        data: {
          suggestionId: suggestion._id,
          error
        }
      });
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(notification) {
    const { user, title, message, action, data } = notification;

    if (!user.email || !user.preferences?.notificationSettings?.emailNotifications) {
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: title,
      html: this.buildEmailTemplate(notification),
      text: message
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  /**
   * Send push notification (placeholder - implement with your push service)
   */
  async sendPushNotification(notification) {
    const { user, title, message, action, data } = notification;

    if (!user.preferences?.notificationSettings?.pushNotifications) {
      return;
    }

    // Implement with your push notification service (Firebase, OneSignal, etc.)
    console.log('Push notification:', { title, message, user: user._id });
    
    // Example with Firebase Cloud Messaging
    // const payload = {
    //   notification: { title, body: message },
    //   data: { suggestionId: data.suggestionId, type: data.type }
    // };
    // await admin.messaging().sendToDevice(user.pushToken, payload);
  }

  /**
   * Save in-app notification
   */
  async saveInAppNotification(notification) {
    const { user, type, title, message, action, data } = notification;

    // Create InAppNotification model if it doesn't exist
    const InAppNotification = mongoose.models.InAppNotification || 
      mongoose.model('InAppNotification', new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: String,
        title: String,
        message: String,
        action: mongoose.Schema.Types.Mixed,
        data: mongoose.Schema.Types.Mixed,
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }));

    const inApp = new InAppNotification({
      userId: user._id,
      type,
      title,
      message,
      action,
      data,
      read: false,
      createdAt: new Date()
    });

    await inApp.save();
  }

  /**
   * Get user's preferred notification channels
   */
  getUserChannels(user, notificationType) {
    const channels = [];
    const prefs = user.preferences?.notificationSettings || {};

    if (prefs.emailNotifications) {
      channels.push('email');
    }
    if (prefs.pushNotifications) {
      channels.push('push');
    }
    // In-app notifications are always enabled
    channels.push('inApp');

    return channels;
  }

  /**
   * Build email template
   */
  buildEmailTemplate(notification) {
    const { title, message, suggestion, action, data } = notification;

    let impactHtml = '';
    if (suggestion?.estimatedImpact) {
      const impact = suggestion.estimatedImpact;
      impactHtml = `
        <div style="margin: 20px 0; padding: 15px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">📊 Estimated Impact</h3>
          ${impact.amount ? 
            `<p style="margin: 5px 0;"><strong>Amount:</strong> $${impact.amount.toFixed(2)}</p>` : ''}
          ${impact.percentage ? 
            `<p style="margin: 5px 0;"><strong>Percentage:</strong> ${impact.percentage.toFixed(1)}%</p>` : ''}
          ${impact.timeframe ? 
            `<p style="margin: 5px 0;"><strong>Timeframe:</strong> ${impact.timeframe}</p>` : ''}
          ${impact.confidence ? 
            `<p style="margin: 5px 0;"><strong>Confidence:</strong> ${impact.confidence}%</p>` : ''}
        </div>
      `;
    }

    let actionHtml = '';
    if (action) {
      actionHtml = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${action.url}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; hover: background-color: #2563eb;">
            ${action.text}
          </a>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 15px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="font-size: 16px; line-height: 1.6; color: #374151;">
              <p style="margin-top: 0;">${message}</p>
              
              ${impactHtml}
              
              ${actionHtml}
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
                <p style="margin: 0;">This suggestion will expire on ${new Date(suggestion?.metadata?.expiresAt).toLocaleDateString()}.</p>
                <p style="margin: 10px 0 0 0;">You can manage notification preferences in your account settings.</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Your Financial App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(notifications) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const notification of notifications) {
      try {
        await this.notifyNewSuggestion(notification.suggestion);
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          suggestionId: notification.suggestion._id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(userId) {
    const InAppNotification = mongoose.model('InAppNotification');
    return await InAppNotification.find({
      userId,
      read: false
    }).sort({ createdAt: -1 }).limit(50);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const InAppNotification = mongoose.model('InAppNotification');
    return await InAppNotification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const InAppNotification = mongoose.model('InAppNotification');
    return await InAppNotification.updateMany(
      { userId, read: false },
      { read: true }
    );
  }
}

module.exports = new NotificationService();