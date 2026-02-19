const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Create Redis client if available
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
}

// General API rate limiter
const apiLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for ingestion endpoints
const ingestionLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:ingestion:'
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 ingestion requests per hour
  message: {
    success: false,
    error: 'Ingestion limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints limiter
const authLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSV upload limiter
const csvUploadLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:csv:'
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 CSV uploads per hour
  message: {
    success: false,
    error: 'CSV upload limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI analysis limiter
const aiLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:ai:'
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 AI requests per hour
  message: {
    success: false,
    error: 'AI analysis limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Skip rate limiting in test environment
if (process.env.NODE_ENV === 'test') {
  apiLimiter.skip = () => true;
  ingestionLimiter.skip = () => true;
  authLimiter.skip = () => true;
  csvUploadLimiter.skip = () => true;
  aiLimiter.skip = () => true;
}

module.exports = {
  apiLimiter,
  ingestionLimiter,
  authLimiter,
  csvUploadLimiter,
  aiLimiter
};