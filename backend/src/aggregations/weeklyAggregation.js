const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function aggregateWeeklyData(userId, date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start from Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const aggregation = await Transaction.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        date: { $gte: startOfWeek, $lte: endOfWeek },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          categoryId: '$categoryId',
          type: '$type'
        },
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $group: {
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'income'] }, '$totalAmount', 0]
          }
        },
        totalExpenses: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'expense'] }, '$totalAmount', 0]
          }
        },
        netSavings: {
          $sum: {
            $cond: [
              { $eq: ['$_id.type', 'expense'] },
              { $multiply: ['$totalAmount', -1] },
              '$totalAmount'
            ]
          }
        },
        categoryBreakdown: { $push: '$$ROOT' },
        totalTransactions: { $sum: '$transactionCount' }
      }
    },
    {
      $project: {
        _id: 0,
        weekStart: startOfWeek,
        weekEnd: endOfWeek,
        totalIncome: 1,
        totalExpenses: 1,
        netSavings: 1,
        totalTransactions: 1,
        categoryBreakdown: 1,
        metadata: {
          generatedAt: new Date(),
          timeRange: {
            start: startOfWeek,
            end: endOfWeek
          }
        }
      }
    }
  ]);

  return aggregation[0] || {
    weekStart: startOfWeek,
    weekEnd: endOfWeek,
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    totalTransactions: 0,
    categoryBreakdown: []
  };
}

module.exports = { aggregateWeeklyData };