const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function calculateRollingAverage(userId, days = 30, endDate = new Date()) {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  
  // 90-day analysis window constraint
  const maxWindowStart = new Date(endDate);
  maxWindowStart.setDate(maxWindowStart.getDate() - 90);
  
  if (startDate < maxWindowStart) {
    throw new Error('Analysis window exceeds 90-day constraint');
  }

  const aggregation = await Transaction.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $facet: {
        dailyAverages: [
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                type: '$type'
              },
              total: { $sum: '$amount' }
            }
          },
          {
            $group: {
              _id: '$_id.date',
              income: {
                $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] }
              },
              expenses: {
                $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] }
              }
            }
          },
          {
            $sort: { '_id': 1 }
          },
          {
            $group: {
              _id: null,
              avgDailyIncome: { $avg: '$income' },
              avgDailyExpenses: { $avg: '$expenses' },
              avgDailyNet: { $avg: { $subtract: ['$income', '$expenses'] } },
              dailyData: { $push: '$$ROOT' }
            }
          }
        ],
        weeklyTrends: [
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                week: { $week: '$date' },
                type: '$type'
              },
              total: { $sum: '$amount' }
            }
          },
          {
            $group: {
              _id: {
                year: '$_id.year',
                week: '$_id.week'
              },
              income: {
                $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] }
              },
              expenses: {
                $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] }
              }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.week': 1 }
          },
          {
            $group: {
              _id: null,
              avgWeeklyIncome: { $avg: '$income' },
              avgWeeklyExpenses: { $avg: '$expenses' },
              avgWeeklyNet: { $avg: { $subtract: ['$income', '$expenses'] } },
              weeklyData: { $push: '$$ROOT' }
            }
          }
        ],
        categoryAverages: [
          {
            $match: { type: 'expense' }
          },
          {
            $group: {
              _id: '$categoryId',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
              avgAmount: { $avg: '$amount' }
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
            $project: {
              categoryName: { $arrayElemAt: ['$category.name', 0] },
              categoryType: { $arrayElemAt: ['$category.type', 0] },
              total: 1,
              count: 1,
              avgAmount: 1,
              dailyAvg: { $divide: ['$total', days] },
              weeklyAvg: { $multiply: [{ $divide: ['$total', days] }, 7] },
              monthlyAvg: { $multiply: [{ $divide: ['$total', days] }, 30] }
            }
          },
          {
            $sort: { total: -1 }
          }
        ]
      }
    }
  ]);

  const result = aggregation[0] || {};
  
  return {
    period: {
      start: startDate,
      end: endDate,
      days: days
    },
    dailyAverages: result.dailyAverages?.[0] || {
      avgDailyIncome: 0,
      avgDailyExpenses: 0,
      avgDailyNet: 0,
      dailyData: []
    },
    weeklyTrends: result.weeklyTrends?.[0] || {
      avgWeeklyIncome: 0,
      avgWeeklyExpenses: 0,
      avgWeeklyNet: 0,
      weeklyData: []
    },
    categoryAverages: result.categoryAverages || [],
    projectedMonthly: {
      income: (result.dailyAverages?.[0]?.avgDailyIncome || 0) * 30,
      expenses: (result.dailyAverages?.[0]?.avgDailyExpenses || 0) * 30,
      net: (result.dailyAverages?.[0]?.avgDailyNet || 0) * 30
    },
    metadata: {
      generatedAt: new Date(),
      analysisWindow: `${days} days`,
      constraint: '90-day maximum window'
    }
  };
}

module.exports = { calculateRollingAverage };