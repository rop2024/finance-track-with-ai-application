const csv = require('csv-parse');
const fs = require('fs');
const TransactionValidator = require('./validators/transaction.validator');

class CSVParserService {
  constructor() {
    this.requiredHeaders = ['amount', 'type', 'description', 'date'];
    this.optionalHeaders = ['category', 'paymentMethod', 'notes', 'tags', 'merchant'];
    this.supportedDateFormats = [
      'YYYY-MM-DD',
      'MM/DD/YYYY',
      'DD/MM/YYYY',
      'YYYY-MM-DD HH:mm:ss'
    ];
  }

  async parseCSV(filePath, userId, mapping = null) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      const headers = [];

      fs.createReadStream(filePath)
        .pipe(csv.parse({
          columns: (headerRow) => {
            headerRow.forEach(h => headers.push(h.trim()));
            return headerRow;
          },
          trim: true,
          skip_empty_lines: true,
          relax_column_count: false
        }))
        .on('data', (row) => {
          try {
            const mappedRow = this.mapRowToSchema(row, headers, mapping);
            const transaction = this.transformToTransaction(mappedRow, userId);
            
            const validation = TransactionValidator.validateManualEntry(transaction);
            
            if (validation.isValid) {
              results.push(validation.sanitizedData);
            } else {
              errors.push({
                row: results.length + 1,
                data: row,
                errors: validation.errors
              });
            }
          } catch (error) {
            errors.push({
              row: results.length + 1,
              data: row,
              errors: [error.message]
            });
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            imported: results.length,
            failed: errors.length,
            data: results,
            errors,
            headers: headers
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async generatePreview(filePath, rowCount = 5) {
    return new Promise((resolve, reject) => {
      const preview = [];
      const headers = [];

      fs.createReadStream(filePath)
        .pipe(csv.parse({
          columns: (headerRow) => {
            headers.push(...headerRow.map(h => h.trim()));
            return headerRow;
          },
          trim: true,
          to: rowCount
        }))
        .on('data', (row) => {
          preview.push(row);
        })
        .on('end', () => {
          resolve({
            headers,
            sampleRows: preview,
            totalEstimated: preview.length,
            suggestedMapping: this.suggestMapping(headers)
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  mapRowToSchema(row, headers, mapping = null) {
    const mapped = {};

    // If mapping provided, use it
    if (mapping) {
      Object.entries(mapping).forEach(([field, headerIndex]) => {
        if (headerIndex >= 0 && row[headerIndex]) {
          mapped[field] = row[headerIndex];
        }
      });
    } else {
      // Auto-map based on header names
      headers.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase().trim();
        
        if (normalizedHeader.includes('amount') || normalizedHeader.includes('price') || normalizedHeader.includes('cost')) {
          mapped.amount = row[index];
        } else if (normalizedHeader.includes('desc')) {
          mapped.description = row[index];
        } else if (normalizedHeader.includes('date')) {
          mapped.date = row[index];
        } else if (normalizedHeader.includes('type')) {
          mapped.type = row[index];
        } else if (normalizedHeader.includes('category')) {
          mapped.categoryName = row[index];
        } else if (normalizedHeader.includes('method') || normalizedHeader.includes('payment')) {
          mapped.paymentMethod = row[index];
        }
      });
    }

    return mapped;
  }

  transformToTransaction(mappedRow, userId) {
    // Parse amount (handle currency symbols and commas)
    let amount = mappedRow.amount;
    if (typeof amount === 'string') {
      amount = amount.replace(/[$,€£¥]/g, '').replace(/,/g, '');
    }
    amount = parseFloat(amount);

    // Parse date
    let date = new Date(mappedRow.date);
    if (isNaN(date.getTime())) {
      // Try common formats
      const parts = mappedRow.date.split(/[-/]/);
      if (parts.length === 3) {
        // Assume MM/DD/YYYY or DD/MM/YYYY
        if (parts[0] > 12) {
          // Probably DD/MM/YYYY
          date = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          // Probably MM/DD/YYYY
          date = new Date(parts[2], parts[0] - 1, parts[1]);
        }
      }
    }

    // Determine type based on amount sign
    let type = mappedRow.type;
    if (!type && amount) {
      type = amount > 0 ? 'income' : 'expense';
      amount = Math.abs(amount);
    }

    return {
      userId,
      amount: amount || 0,
      type: type?.toLowerCase?.() || 'expense',
      description: mappedRow.description || mappedRow.merchant || 'Imported transaction',
      date: date || new Date(),
      paymentMethod: this.mapPaymentMethod(mappedRow.paymentMethod),
      merchant: {
        name: mappedRow.merchant || mappedRow.description
      },
      notes: mappedRow.notes,
      tags: mappedRow.tags ? mappedRow.tags.split(',').map(t => t.trim()) : []
    };
  }

  mapPaymentMethod(method) {
    if (!method) return 'other';
    
    const methodMap = {
      'cash': 'cash',
      'credit': 'credit_card',
      'debit': 'debit_card',
      'card': 'credit_card',
      'bank': 'bank_transfer',
      'transfer': 'bank_transfer',
      'paypal': 'digital_wallet',
      'venmo': 'digital_wallet',
      'apple pay': 'digital_wallet',
      'google pay': 'digital_wallet'
    };

    const normalizedMethod = method.toLowerCase().trim();
    for (const [key, value] of Object.entries(methodMap)) {
      if (normalizedMethod.includes(key)) {
        return value;
      }
    }

    return 'other';
  }

  suggestMapping(headers) {
    const suggestions = {};

    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase();
      
      if (lowerHeader.includes('amount') || lowerHeader.includes('price') || lowerHeader.includes('sum')) {
        suggestions.amount = index;
      } else if (lowerHeader.includes('date')) {
        suggestions.date = index;
      } else if (lowerHeader.includes('desc') || lowerHeader.includes('note') || lowerHeader.includes('memo')) {
        suggestions.description = index;
      } else if (lowerHeader.includes('type') || lowerHeader.includes('kind')) {
        suggestions.type = index;
      } else if (lowerHeader.includes('category')) {
        suggestions.category = index;
      } else if (lowerHeader.includes('merchant') || lowerHeader.includes('payee') || lowerHeader.includes('vendor')) {
        suggestions.merchant = index;
      } else if (lowerHeader.includes('method') || lowerHeader.includes('payment')) {
        suggestions.paymentMethod = index;
      } else if (lowerHeader.includes('tag')) {
        suggestions.tags = index;
      }
    });

    return suggestions;
  }

  validateHeaders(headers) {
    const missingRequired = this.requiredHeaders.filter(
      required => !headers.some(h => h.toLowerCase().includes(required.toLowerCase()))
    );

    return {
      valid: missingRequired.length === 0,
      missingRequired,
      presentHeaders: headers,
      suggestedHeaders: this.requiredHeaders
    };
  }
}

module.exports = CSVParserService;