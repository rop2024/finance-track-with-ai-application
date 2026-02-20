const cron = require('node-cron');
const SummaryGenerator = require('./summary.generator');
const User = require('../../models/User');
const WeeklySummary = require('../../models/WeeklySummary');

class WeeklyScheduler {
  constructor() {
    this.isRunning = false;
    this.generationWindow = 24; // Hours to generate summaries
  }

  /**
   * Start the weekly summary scheduler
   */
  start() {
    // Run every Monday at 2 AM
    cron.schedule('0 2 * * 1', () => {
      this.generateWeeklySummaries();
    });

    console.log('Weekly summary scheduler started');
  }

  /**
   * Generate summaries for all active users
   */
  async generateWeeklySummaries() {
    if (this.isRunning) {
      console.log('Summary generation already in progress');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Get all active users
      const users = await User.find({
        'preferences.notificationSettings.weeklySummary': { $ne: false }
      }).select('_id');

      console.log(`Generating weekly summaries for ${users.length} users`);

      let successCount = 0;
      let errorCount = 0;

      // Process users in batches
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (user) => {
            try {
              await SummaryGenerator.generateWeeklySummary(user._id);
              successCount++;
            } catch (error) {
              console.error(`Error generating summary for user ${user._id}:`, error);
              errorCount++;
            }
          })
        );

        // Small delay between batches
        await this.sleep(1000);
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Weekly summary generation complete: ${successCount} succeeded, ${errorCount} failed in ${duration}s`);

    } catch (error) {
      console.error('Error in weekly summary generation:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Generate summary for specific user on demand
   */
  async generateForUser(userId) {
    try {
      const summary = await SummaryGenerator.generateWeeklySummary(userId);
      return summary;
    } catch (error) {
      console.error(`Error generating summary for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if summary exists for current week
   */
  async hasCurrentWeekSummary(userId) {
    const weekStart = this.getWeekStart(new Date());
    
    const existing = await WeeklySummary.findOne({
      userId,
      weekStart
    });

    return !!existing;
  }

  /**
   * Get week start date
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await WeeklySummary.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          avgGenerationTime: { $avg: '$metadata.generationTime' },
          totalDataPoints: { $sum: '$metadata.dataPoints' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
    ]);

    return stats;
  }

  /**
   * Retry failed generations
   */
  async retryFailed(daysBack = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Find users without summaries for recent weeks
    const usersWithSummaries = await WeeklySummary.distinct('userId', {
      weekStart: { $gte: startDate }
    });

    const allUsers = await User.find().distinct('_id');
    const usersWithoutSummaries = allUsers.filter(
      id => !usersWithSummaries.includes(id.toString())
    );

    console.log(`Retrying generation for ${usersWithoutSummaries.length} users`);

    let successCount = 0;
    for (const userId of usersWithoutSummaries) {
      try {
        await this.generateForUser(userId);
        successCount++;
      } catch (error) {
        console.error(`Retry failed for user ${userId}:`, error);
      }
    }

    return {
      attempted: usersWithoutSummaries.length,
      succeeded: successCount,
      failed: usersWithoutSummaries.length - successCount
    };
  }
}

module.exports = new WeeklyScheduler();