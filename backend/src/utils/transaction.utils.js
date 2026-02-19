const mongoose = require('mongoose');

class TransactionUtils {
  /**
   * Execute operations in a transaction
   */
  async executeInTransaction(operations, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];
      
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }

      await session.commitTransaction();
      return {
        success: true,
        results
      };

    } catch (error) {
      await session.abortTransaction();
      return {
        success: false,
        error: error.message,
        operations
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Create a checkpoint for potential rollback
   */
  async createCheckpoint(userId, metadata = {}) {
    const Checkpoint = mongoose.model('Checkpoint') || 
      mongoose.model('Checkpoint', new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        data: mongoose.Schema.Types.Mixed,
        metadata: mongoose.Schema.Types.Mixed
      }));

    // Capture current state of relevant data
    const [budgets, goals, subscriptions, categories] = await Promise.all([
      mongoose.model('Budget').find({ userId }).lean(),
      mongoose.model('SavingsGoal').find({ userId }).lean(),
      mongoose.model('Subscription').find({ userId }).lean(),
      mongoose.model('Category').find({ userId }).lean()
    ]);

    const checkpoint = new Checkpoint({
      userId,
      data: {
        budgets,
        goals,
        subscriptions,
        categories,
        timestamp: new Date()
      },
      metadata
    });

    await checkpoint.save();
    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  async restoreFromCheckpoint(checkpointId, userId) {
    const Checkpoint = mongoose.model('Checkpoint');
    const checkpoint = await Checkpoint.findOne({
      _id: checkpointId,
      userId
    });

    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Restore budgets
      if (checkpoint.data.budgets) {
        await mongoose.model('Budget').deleteMany({ userId }).session(session);
        await mongoose.model('Budget').insertMany(
          checkpoint.data.budgets.map(b => ({ ...b, _id: b._id })),
          { session }
        );
      }

      // Restore goals
      if (checkpoint.data.goals) {
        await mongoose.model('SavingsGoal').deleteMany({ userId }).session(session);
        await mongoose.model('SavingsGoal').insertMany(
          checkpoint.data.goals.map(g => ({ ...g, _id: g._id })),
          { session }
        );
      }

      // Restore subscriptions
      if (checkpoint.data.subscriptions) {
        await mongoose.model('Subscription').deleteMany({ userId }).session(session);
        await mongoose.model('Subscription').insertMany(
          checkpoint.data.subscriptions.map(s => ({ ...s, _id: s._id })),
          { session }
        );
      }

      // Restore categories
      if (checkpoint.data.categories) {
        await mongoose.model('Category').deleteMany({ userId }).session(session);
        await mongoose.model('Category').insertMany(
          checkpoint.data.categories.map(c => ({ ...c, _id: c._id })),
          { session }
        );
      }

      await session.commitTransaction();

      return {
        success: true,
        restoredAt: new Date(),
        checkpoint
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Create a snapshot of current state
   */
  async createSnapshot(userId, label) {
    const Snapshot = mongoose.model('Snapshot') || 
      mongoose.model('Snapshot', new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        label: String,
        timestamp: { type: Date, default: Date.now },
        data: mongoose.Schema.Types.Mixed,
        metadata: mongoose.Schema.Types.Mixed
      }));

    const [budgets, goals, subscriptions, categories, transactions] = await Promise.all([
      mongoose.model('Budget').find({ userId }).lean(),
      mongoose.model('SavingsGoal').find({ userId }).lean(),
      mongoose.model('Subscription').find({ userId }).lean(),
      mongoose.model('Category').find({ userId }).lean(),
      mongoose.model('Transaction').find({ 
        userId,
        date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      }).lean()
    ]);

    const snapshot = new Snapshot({
      userId,
      label,
      data: {
        budgets,
        goals,
        subscriptions,
        categories,
        transactions,
        summary: {
          budgetCount: budgets.length,
          goalCount: goals.length,
          subscriptionCount: subscriptions.length,
          categoryCount: categories.length,
          transactionCount: transactions.length,
          totalSpent: transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0),
          totalIncome: transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)
        }
      },
      timestamp: new Date()
    });

    await snapshot.save();
    return snapshot;
  }

  /**
   * Compare two states
   */
  compareStates(state1, state2) {
    const differences = [];

    // Compare budgets
    if (state1.budgets && state2.budgets) {
      const budgetDiff = this.compareArrays(
        state1.budgets,
        state2.budgets,
        'budgetId'
      );
      differences.push(...budgetDiff);
    }

    // Compare goals
    if (state1.goals && state2.goals) {
      const goalDiff = this.compareArrays(
        state1.goals,
        state2.goals,
        'goalId'
      );
      differences.push(...goalDiff);
    }

    return {
      hasDifferences: differences.length > 0,
      differences
    };
  }

  /**
   * Compare two arrays of objects
   */
  compareArrays(arr1, arr2, idField) {
    const differences = [];
    const map1 = new Map(arr1.map(item => [item[idField], item]));
    const map2 = new Map(arr2.map(item => [item[idField], item]));

    // Find items in arr1 not in arr2 (deleted)
    for (const [id, item] of map1) {
      if (!map2.has(id)) {
        differences.push({
          type: 'deleted',
          id,
          item
        });
      }
    }

    // Find items in arr2 not in arr1 (added)
    for (const [id, item] of map2) {
      if (!map1.has(id)) {
        differences.push({
          type: 'added',
          id,
          item
        });
      }
    }

    // Find modified items
    for (const [id, item1] of map1) {
      const item2 = map2.get(id);
      if (item2) {
        const changes = this.findChanges(item1, item2);
        if (changes.length > 0) {
          differences.push({
            type: 'modified',
            id,
            changes
          });
        }
      }
    }

    return differences;
  }

  /**
   * Find changes between two objects
   */
  findChanges(obj1, obj2, path = '') {
    const changes = [];

    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1[key];
      const val2 = obj2[key];

      if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
        // Recursively check nested objects
        const nestedChanges = this.findChanges(val1, val2, currentPath);
        changes.push(...nestedChanges);
      } else if (val1 !== val2) {
        changes.push({
          field: currentPath,
          oldValue: val1,
          newValue: val2
        });
      }
    }

    return changes;
  }

  /**
   * Generate undo operation
   */
  generateUndo(change) {
    switch(change.type) {
      case 'added':
        return {
          operation: 'delete',
          id: change.id,
          model: this.getModelName(change.item)
        };

      case 'deleted':
        return {
          operation: 'create',
          data: change.item,
          model: this.getModelName(change.item)
        };

      case 'modified':
        return {
          operation: 'update',
          id: change.id,
          data: change.changes.reduce((acc, c) => {
            acc[c.field] = c.oldValue;
            return acc;
          }, {}),
          model: this.getModelName(change.changes[0]?.field)
        };

      default:
        return null;
    }
  }

  /**
   * Get model name from item
   */
  getModelName(item) {
    if (item.amount !== undefined && item.period) return 'Budget';
    if (item.targetAmount !== undefined) return 'SavingsGoal';
    if (item.recurrence !== undefined) return 'Subscription';
    if (item.type && item.icon) return 'Category';
    return 'Unknown';
  }
}

module.exports = new TransactionUtils();