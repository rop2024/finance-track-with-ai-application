const transactionValidation = require('./transaction.validation');
const authValidation = require('./auth.validation');

module.exports = {
  ...transactionValidation,
  ...authValidation,
  
  // Generic validation handler
  handleValidationErrors: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
};