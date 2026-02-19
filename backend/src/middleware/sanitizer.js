const sanitizeHtml = require('sanitize-html');

// Configure HTML sanitization
const sanitizeOptions = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {}, // No attributes allowed
  disallowedTagsMode: 'discard',
  allowedSchemes: [],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true
};

// Sanitize request body recursively
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Sanitize HTML and trim
      sanitized[key] = sanitizeHtml(value, sanitizeOptions).trim();
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Middleware to sanitize all input
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Special sanitizer for CSV data (less aggressive)
const sanitizeForCSV = (data) => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // For CSV data, just trim and remove dangerous characters
      sanitized[key] = value
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
        .replace(/[\\$;|&]/g, ''); // Remove shell metacharacters
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForCSV(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Remove MongoDB operators to prevent injection
const preventNoSQLInjection = (req, res, next) => {
  const hasMongoOperators = (obj) => {
    if (typeof obj !== 'object' || obj === null) return false;
    
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$')) {
        return true;
      }
      if (typeof obj[key] === 'object') {
        if (hasMongoOperators(obj[key])) return true;
      }
    }
    return false;
  };

  if (hasMongoOperators(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input: MongoDB operators are not allowed'
    });
  }

  next();
};

module.exports = {
  sanitizeInput,
  sanitizeForCSV,
  preventNoSQLInjection
};