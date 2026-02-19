/**
 * Utility functions for database index optimization
 */
class IndexUtils {
  /**
   * Generate index recommendations based on query patterns
   */
  static analyzeQueryPatterns(queries) {
    const fieldUsage = {};
    const compoundPatterns = {};

    queries.forEach(query => {
      // Analyze fields used in query
      Object.keys(query.filter || {}).forEach(field => {
        fieldUsage[field] = (fieldUsage[field] || 0) + 1;
      });

      // Analyze sort fields
      if (query.sort) {
        Object.keys(query.sort).forEach(field => {
          fieldUsage[`sort:${field}`] = (fieldUsage[`sort:${field}`] || 0) + 1;
        });
      }

      // Analyze compound patterns
      if (query.filter && Object.keys(query.filter).length > 1) {
        const pattern = Object.keys(query.filter).sort().join('_');
        compoundPatterns[pattern] = (compoundPatterns[pattern] || 0) + 1;
      }
    });

    return {
      fieldFrequency: this.sortByValue(fieldUsage),
      compoundPatterns: this.sortByValue(compoundPatterns),
      recommendations: this.generateIndexRecommendations(fieldUsage, compoundPatterns)
    };
  }

  /**
   * Generate index recommendations
   */
  static generateIndexRecommendations(fieldUsage, compoundPatterns) {
    const recommendations = [];

    // Single field indexes
    Object.entries(fieldUsage)
      .filter(([field, count]) => count > 10 && !field.startsWith('sort:'))
      .forEach(([field, count]) => {
        recommendations.push({
          type: 'single',
          fields: [field],
          estimatedQueries: count,
          reason: `Field used in ${count} queries`
        });
      });

    // Compound indexes
    Object.entries(compoundPatterns)
      .filter(([_, count]) => count > 5)
      .forEach(([pattern, count]) => {
        const fields = pattern.split('_');
        recommendations.push({
          type: 'compound',
          fields,
          estimatedQueries: count,
          reason: `Common compound query pattern with fields: ${fields.join(', ')}`
        });
      });

    return recommendations;
  }

  /**
   * Get index statistics for a collection
   */
  static async getIndexStats(collection) {
    const indexes = await collection.listIndexes().toArray();
    const stats = await collection.stats();

    return {
      totalIndexes: indexes.length,
      indexDetails: indexes.map(idx => ({
        name: idx.name,
        key: idx.key,
        size: stats.indexSizes[idx.name],
        unique: idx.unique || false,
        sparse: idx.sparse || false
      })),
      totalIndexSize: stats.totalIndexSize,
      indexRatio: stats.totalIndexSize / stats.size
    };
  }

  /**
   * Analyze index usage from explain plans
   */
  static analyzeIndexUsage(explainResults) {
    const usage = {
      usedIndex: null,
      scanType: 'COLLSCAN',
      docsExamined: 0,
      keysExamined: 0
    };

    if (explainResults.queryPlanner) {
      const winningPlan = explainResults.queryPlanner.winningPlan;
      
      if (winningPlan.stage === 'FETCH' && winningPlan.inputStage) {
        usage.scanType = 'IXSCAN';
        usage.usedIndex = winningPlan.inputStage.indexName;
        usage.keysExamined = winningPlan.inputStage.keysExamined || 0;
      }

      if (explainResults.executionStats) {
        usage.docsExamined = explainResults.executionStats.totalDocsExamined;
        usage.executionTime = explainResults.executionStats.executionTimeMillis;
      }
    }

    return usage;
  }

  /**
   * Suggest indexes for common financial queries
   */
  static getFinancialIndexSuggestions() {
    return [
      {
        collection: 'transactions',
        indexes: [
          { fields: { userId: 1, date: -1 }, name: 'user_date' },
          { fields: { userId: 1, categoryId: 1, date: -1 }, name: 'user_category_date' },
          { fields: { userId: 1, type: 1, date: -1 }, name: 'user_type_date' },
          { fields: { userId: 1, status: 1, date: -1 }, name: 'user_status_date' },
          { fields: { userId: 1, 'merchant.name': 1 }, name: 'user_merchant' }
        ]
      },
      {
        collection: 'budgets',
        indexes: [
          { fields: { userId: 1, isActive: 1 }, name: 'user_active' },
          { fields: { userId: 1, categoryId: 1, period: 1 }, name: 'user_category_period' },
          { fields: { userId: 1, startDate: 1, endDate: 1 }, name: 'user_date_range' }
        ]
      },
      {
        collection: 'subscriptions',
        indexes: [
          { fields: { userId: 1, status: 1 }, name: 'user_status' },
          { fields: { userId: 1, 'recurrence.nextBillingDate': 1 }, name: 'user_next_billing' },
          { fields: { userId: 1, categoryId: 1 }, name: 'user_category' }
        ]
      },
      {
        collection: 'savingsgoals',
        indexes: [
          { fields: { userId: 1, status: 1, priority: 1 }, name: 'user_status_priority' },
          { fields: { userId: 1, targetDate: 1 }, name: 'user_target_date' }
        ]
      },
      {
        collection: 'financialsignals',
        indexes: [
          { fields: { userId: 1, type: 1, 'period.startDate': -1 }, name: 'user_type_date' },
          { fields: { userId: 1, isActive: 1, priority: 1 }, name: 'user_active_priority' },
          { fields: { expiresAt: 1 }, name: 'ttl_expiry' }
        ]
      }
    ];
  }

  /**
   * Validate if index is being used effectively
   */
  static validateIndexEffectiveness(explainResults, expectedIndex) {
    const usage = this.analyzeIndexUsage(explainResults);
    
    return {
      isUsingIndex: usage.usedIndex === expectedIndex,
      actualIndex: usage.usedIndex,
      scanType: usage.scanType,
      efficiency: usage.keysExamined > 0 
        ? usage.docsExamined / usage.keysExamined 
        : 0,
      recommendation: usage.scanType === 'COLLSCAN' 
        ? 'Add index to avoid collection scan' 
        : 'Index is being used effectively'
    };
  }

  /**
   * Sort object by values
   */
  static sortByValue(obj) {
    return Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
  }

  /**
   * Generate create index commands
   */
  static generateCreateIndexCommands(collection, indexes) {
    return indexes.map(index => {
      const options = {
        name: index.name,
        ...(index.unique && { unique: true }),
        ...(index.sparse && { sparse: true }),
        ...(index.expireAfterSeconds && { expireAfterSeconds: index.expireAfterSeconds })
      };

      return {
        collection,
        key: index.fields,
        options,
        command: `db.${collection}.createIndex(${JSON.stringify(index.fields)}, ${JSON.stringify(options)})`
      };
    });
  }

  /**
   * Analyze index coverage for a query
   */
  static analyzeIndexCoverage(query, indexes) {
    const queryFields = new Set(Object.keys(query));
    let bestIndex = null;
    let bestCoverage = 0;

    indexes.forEach(index => {
      const indexFields = new Set(Object.keys(index.key));
      const coveredFields = [...queryFields].filter(f => indexFields.has(f));
      const coverage = coveredFields.length / queryFields.size;

      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        bestIndex = index;
      }
    });

    return {
      queryFields: [...queryFields],
      bestIndex: bestIndex?.name,
      coverage: bestCoverage * 100,
      isFullyCovered: bestCoverage === 1,
      missingIndexes: bestCoverage < 1 
        ? [...queryFields].filter(f => !bestIndex?.key[f])
        : []
    };
  }
}

module.exports = IndexUtils;