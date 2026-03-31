const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    type: 'https://httpstatuses.com/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    type: 'https://httpstatuses.com/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many authentication attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limiter for prediction endpoints (computationally expensive)
const predictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 predictions per minute
  message: {
    type: 'https://httpstatuses.com/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many prediction requests, please try again after 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  predictLimiter
};
