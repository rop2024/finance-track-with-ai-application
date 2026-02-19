const mongoose = require('mongoose');
const Transaction = require('../../../models/Transaction');

class CategoryCalculator {
  /**
   * Calculate category totals for a given period with optimized aggregation
   */
  async calculateCategoryTotals(userId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          status: 'completed',
          type: 'expense'
        }
      },
      {
        $group: {
          _id: '$categoryId',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
          firstTransaction: { $min: '$date' },
          lastTransaction: { $max: '$date' },
          transactions: { $push: { amount: '$amount', date: '$date' } }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: '$categoryInfo'
      },
      {
        $project: {
          categoryId: '$_id',
          categoryName: '$categoryInfo.name',
          categoryType: '$categoryInfo.type',
          total: 1,
          count: 1,
          avgAmount: 1,
          minAmount: 1,
          maxAmount: 1,
          firstTransaction: 1,
          lastTransaction: 1,
          frequency: { $divide: ['$count', this.getDaysBetween(startDate, endDate)] },
          transactions: 1
        }
      },
      {
        $sort: { total: -1 }
      }
    ];

    const results = await Transaction.aggregate(pipeline);
    
    // Calculate additional metrics
    const grandTotal = results.reduce((sum, cat) => sum + cat.total, 0);
    
    return results.map(cat => ({
      ...cat,
      percentageOfTotal: grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0,
      dailyAverage: cat.total / this.getDaysBetween(startDate, endDate),
      volatility: this.calculateVolatility(cat.transactions)
    }));
  }

  /**
   * Calculate category deltas between two periods
   */
  async calculateCategoryDeltas(userId, currentStart, currentEnd, previousStart, previousEnd) {
    const [currentPeriod, previousPeriod] = await Promise.all([
      this.calculateCategoryTotals(userId, currentStart, currentEnd),
      this.calculateCategoryTotals(userId, previousStart, previousEnd)
    ]);

    const previousMap = new Map(
      previousPeriod.map(c => [c.categoryId.toString(), c])
    );

    const deltas = currentPeriod.map(current => {
      const previous = previousMap.get(current.categoryId.toString());
      
      if (!previous) {
        return {
          categoryId: current.categoryId,
          categoryName: current.categoryName,
          categoryType: current.categoryType,
          currentTotal: current.total,
          previousTotal: 0,
          absoluteDelta: current.total,
          percentageDelta: 100,
          isNew: true
        };
      }

      const absoluteDelta = current.total - previous.total;
      const percentageDelta = previous.total > 0 
        ? ((current.total - previous.total) / previous.total) * 100 
        : 100;

      return {
        categoryId: current.categoryId,
        categoryName: current.categoryName,
        categoryType: current.categoryType,
        currentTotal: current.total,
        previousTotal: previous.total,
        absoluteDelta,
        percentageDelta,
        isSignificant: Math.abs(percentageDelta) > 20, // 20% threshold
        trend: absoluteDelta > 0 ? 'increasing' : absoluteDelta < 0 ? 'decreasing' : 'stable'
      };
    });

    // Add categories that existed in previous period but not in current
    const currentIds = new Set(currentPeriod.map(c => c.categoryId.toString()));
    previousPeriod.forEach(prev => {
      if (!currentIds.has(prev.categoryId.toString())) {
        deltas.push({
          categoryId: prev.categoryId,
          categoryName: prev.categoryName,
          categoryType: prev.categoryType,
          currentTotal: 0,
          previousTotal: prev.total,
          absoluteDelta: -prev.total,
          percentageDelta: -100,
          isDiscontinued: true
        });
      }
    });

    return {
      periodComparison: {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd }
      },
      deltas: deltas.sort((a, b) => Math.abs(b.percentageDelta) - Math.abs(a.percentageDelta)),
      summary: {
        totalCurrent: currentPeriod.reduce((sum, c) => sum + c.total, 0),
        totalPrevious: previousPeriod.reduce((sum, c) => sum + c.total, 0),
        totalDelta: currentPeriod.reduce((sum, c) => sum + c.total, 0) - 
                   previousPeriod.reduce((sum, c) => sum + c.total, 0),
        categoriesWithIncrease: deltas.filter(d => d.absoluteDelta > 0).length,
        categoriesWithDecrease: deltas.filter(d => d.absoluteDelta < 0).length,
        newCategories: deltas.filter(d => d.isNew).length,
        discontinuedCategories: deltas.filter(d => d.isDiscontinued).length
      }
    };
  }

  /**
   * Get category spending trends over multiple periods
   */
  async getCategoryTrends(userId, categoryIds, periods = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periods);

    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          status: 'completed',
          type: 'expense',
          ...(categoryIds && { categoryId: { $in: categoryIds.map(id => new mongoose.Types.ObjectId(id)) } })
        }
      },
      {
        $group: {
          _id: {
            categoryId: '$categoryId',
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $group: {
          _id: '$_id.categoryId',
          monthlyData: {
            $push: {
              period: { $concat: [
                { $toString: '$_id.year' },
                '-',
                { $toString: '$_id.month' }
              ]},
              total: '$total',
              count: '$count'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      }
    ];

    return await Transaction.aggregate(pipeline);
  }

  getDaysBetween(startDate, endDate) {
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  calculateVolatility(transactions) {
    if (transactions.length < 2) return 0;
    
    const amounts = transactions.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
}

module.exports = new CategoryCalculator();