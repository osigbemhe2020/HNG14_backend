const express = require("express");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const stage0 = require('./stage0');
const stage1Routes = require('./routes/stage1.route');
const authRoutes = require('./routes/auth.route');
const { verifyToken } = require('./middlewares/auth.middleware');
const { generalLimiter } = require('./middlewares/rateLimit.middleware');
const { setupMorgan } = require('./middlewares/logger.middleware');
const { checkApiVersion } = require('./middlewares/apiVersion.middleware');

const app = express();

// CORS — origin cannot be '*' when credentials (cookies) are used
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:9876', // CLI callback server
  process.env.WEB_PORTAL_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (CLI axios calls, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true, // required for cookies to work cross-origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version']
}));

app.use(express.json());
app.use(cookieParser());
app.use(setupMorgan());

// Auth routes
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