const Transaction = require('../../models/Transaction');
const TransactionValidator = require('./validators/transaction.validator');

class ManualIngestionService {
  async createTransaction(transactionData, userId) {
    // Validate transaction
    const validation = TransactionValidator.validateManualEntry({
      ...transactionData,
      userId
    });

    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Create transaction
    const transaction = new Transaction({
      ...validation.sanitizedData,
      userId
    });

    await transaction.save();
    return transaction;
  }

  async bulkCreateTransactions(transactions, userId) {
    // Validate all transactions
    const validation = TransactionValidator.validateBulkTransactions(transactions);
    
    if (!validation.isValid) {
      return validation;
    }

    // Prepare transactions for insertion
    const validTransactions = validation.results
      .filter(r => r.isValid)
      .map(r => ({
        ...r.sanitizedData,
        userId
      }));

    // Insert in batches
    const batchSize = 100;
    const insertedTransactions = [];

    for (let i = 0; i < validTransactions.length; i += batchSize) {
      const batch = validTransactions.slice(i, i + batchSize);
      const inserted = await Transaction.insertMany(batch, { ordered: false });
      insertedTransactions.push(...inserted);
    }

    return {
      success: true,
      totalRequested: transactions.length,
      validCount: validTransactions.length,
      insertedCount: insertedTransactions.length,
      failedCount: transactions.length - insertedTransactions.length,
      validationResults: validation.results,
      data: insertedTransactions
    };
  }

  async updateTransaction(transactionId, updateData, userId) {
    // Validate update data
    const validation = TransactionValidator.validateManualEntry(updateData);
    
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Update transaction
    const transaction = await Transaction.findOneAndUpdate(
      { _id: transactionId, userId },
      validation.sanitizedData,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  async deleteTransaction(transactionId, userId) {
    const transaction = await Transaction.findOneAndDelete({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  async getTransactionById(transactionId, userId) {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    }).populate('categoryId');

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  async getUserTransactions(userId, filters = {}, pagination = {}) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    // Build query
    const query = { userId };

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) query.date.$lte = new Date(filters.endDate);
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.categoryId) {
      query.categoryId = filters.categoryId;
    }

    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }

    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) query.amount.$gte = filters.minAmount;
      if (filters.maxAmount) query.amount.$lte = filters.maxAmount;
    }

    if (filters.search) {
      query.$or = [
        { description: { $regex: filters.search, $options: 'i' } },
        { 'merchant.name': { $regex: filters.search, $options: 'i' } },
        { notes: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Execute query
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('categoryId')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = ManualIngestionService;