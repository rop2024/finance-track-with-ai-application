const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function aggregateMonthlyData(userId, year, month) {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const aggregation = await Transaction.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        date: { $gte: startOfMonth, $lte: endOfMonth },
        status: 'completed'
      }
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalIncome: {
                $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
              },
              totalExpenses: {
                $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
              },
              transactionCount: { $sum: 1 },
              averageTransaction: { $avg: '$amount' }
            }
          }
        ],
        byCategory: [
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
            $sort: { total: -1 }
          }
        ],
        dailyBreakdown: [
          {
            $group: {
              _id: {
                day: { $dayOfMonth: '$date' },
                type: '$type'
              },
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.day': 1 }
          }
        ],
        byPaymentMethod: [
          {
            $group: {
              _id: '$paymentMethod',
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ],
        recurringVsOneTime: [
          {
            $group: {
              _id: '$isRecurring',
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  const result = aggregation[0] || {};
  
  return {
    month: month + 1,
    year: year,
    periodStart: startOfMonth,
    periodEnd: endOfMonth,
    summary: result.summary?.[0] || {
      totalIncome: 0,
      totalExpenses: 0,
      transactionCount: 0,
      averageTransaction: 0
    },
    categoryBreakdown: result.byCategory || [],
    dailyBreakdown: result.dailyBreakdown || [],
    paymentMethodBreakdown: result.byPaymentMethod || [],
    recurringAnalysis: {
      recurring: result.recurringVsOneTime?.find(r => r._id === true) || { total: 0, count: 0 },
      oneTime: result.recurringVsOneTime?.find(r => r._id === false) || { total: 0, count: 0 }
    },
    metadata: {
      generatedAt: new Date(),
      timeRange: {
        start: startOfMonth,
        end: endOfMonth
      }
    }
  };
}

module.exports = { aggregateMonthlyData };