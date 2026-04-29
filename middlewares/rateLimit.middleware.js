// rateLimit.middleware.js
const rateLimit = require('express-rate-limit');

// Rate limiter for authentication routes - 10 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per window
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 60
    });
  }
});

// Rate limiter for all other routes - 60 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per window
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: 60
    });
  }
});

module.exports = {
  authLimiter,
  generalLimiter
};
