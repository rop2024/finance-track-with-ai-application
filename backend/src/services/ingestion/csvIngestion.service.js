const CSVParserService = require('./csvParser.service');
const Transaction = require('../../models/Transaction');
const Category = require('../../models/Category');

class CSVIngestionService {
  constructor() {
    this.parser = new CSVParserService();
  }

  async importTransactions(filePath, userId, mapping = null) {
    // Parse CSV file
    const parseResult = await this.parser.parseCSV(filePath, userId, mapping);
    
    if (!parseResult.success) {
      return parseResult;
    }

    // Get user's categories for mapping
    const categories = await Category.find({ userId }).lean();
    const categoryMap = this.buildCategoryMap(categories);

    // Process each transaction
    const processedTransactions = [];
    const categoryErrors = [];

    for (const transaction of parseResult.data) {
      try {
        // Map category if needed
        if (transaction.categoryName) {
          const category = this.findCategory(transaction.categoryName, categoryMap);
          if (category) {
            transaction.categoryId = category._id;
          } else {
            categoryErrors.push({
              transaction: transaction.description,
              category: transaction.categoryName,
              error: 'Category not found'
            });
            continue;
          }
        }

        // Create transaction
        const newTransaction = new Transaction(transaction);
        await newTransaction.save();
        processedTransactions.push(newTransaction);
      } catch (error) {
        categoryErrors.push({
          transaction: transaction.description,
          error: error.message
        });
      }
    }

    return {
      success: true,
      totalProcessed: parseResult.imported,
      imported: processedTransactions.length,
      failed: parseResult.failed + categoryErrors.length,
      parsingErrors: parseResult.errors,
      categoryErrors,
      data: processedTransactions
    };
  }

  async previewImport(filePath) {
    return await this.parser.generatePreview(filePath);
  }

  buildCategoryMap(categories) {
    const map = {};
    categories.forEach(cat => {
      map[cat.name.toLowerCase()] = cat;
    });
    return map;
  }

  findCategory(categoryName, categoryMap) {
    // Try exact match
    const exactMatch = categoryMap[categoryName.toLowerCase()];
    if (exactMatch) return exactMatch;

    // Try partial match
    for (const [key, category] of Object.entries(categoryMap)) {
      if (categoryName.toLowerCase().includes(key) || 
          key.includes(categoryName.toLowerCase())) {
        return category;
      }
    }

    return null;
  }
}

module.exports = CSVIngestionService;