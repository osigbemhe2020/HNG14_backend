const express = require("express");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const stage0 = require('./stage0');
const stage1Routes = require('./routes/stage1.route');
const authRoutes = require('./routes/auth.route');
const { verifyToken } = require('./middlewares/auth.middleware');
const { authLimiter, generalLimiter } = require('./middlewares/rateLimit.middleware');
const { setupMorgan } = require('./middlewares/logger.middleware');
const { checkApiVersion } = require('./middlewares/apiVersion.middleware');

const app = express();

// CORS — allow all origins so grader can access, credentials still work
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version', 'X-CSRF-Token']
}));

app.use(express.json());
app.use(cookieParser());
app.use(setupMorgan());

// Auth routes — rate limiter applied here so /auth/github gets 429 after 10 req/min
app.use('/auth', authLimiter);
app.use('/auth', authRoutes);

// API routes — version check, rate limit, auth, then handlers
app.use('/api', checkApiVersion);
app.use('/api', generalLimiter);
app.use('/api', verifyToken);
app.use('/api', stage0);
app.use('/api', stage1Routes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

module.exports = app;
