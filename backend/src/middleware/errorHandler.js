const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = { ...err };
  error.message = err.message;

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    error = {
      statusCode: 400,
      message: `${field} already exists`
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    error = {
      statusCode: 400,
      message: 'Validation error',
      errors
    };
  }

  // Mongoose cast error (invalid ID)
  if (err.name === 'CastError') {
    error = {
      statusCode: 400,
      message: 'Invalid resource ID'
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      statusCode: 401,
      message: 'Invalid token'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      statusCode: 401,
      message: 'Token expired'
    };
  }

  // Custom service errors
  if (err.isServiceError) {
    error = {
      statusCode: err.statusCode || 400,
      message: err.message,
      details: err.details
    };
  }

  // CSV parsing errors
  if (err.code === 'CSV_PARSE_ERROR') {
    error = {
      statusCode: 400,
      message: 'CSV parsing failed',
      details: err.details
    };
  }

  // Rate limit errors
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    error = {
      statusCode: 429,
      message: 'Too many requests, please try again later',
      resetAt: err.resetAt
    };
  }

  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    error: error.message || 'Server error'
  };

  // Add details if available
  if (error.errors) {
    response.errors = error.errors;
  }

  if (error.details) {
    response.details = error.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// Async error wrapper to avoid try-catch in controllers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Service error factory
class ServiceError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.isServiceError = true;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  ServiceError
};