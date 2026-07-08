const path = require('path');
// Load backend/.env regardless of the current working directory
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');

// Import routes
const authRoutes = require('./src/routes/auth');
const firmRoutes = require('./src/routes/firms');
const predictRoutes = require('./src/routes/predict');
const adminRoutes = require('./src/routes/admin');

const app = express();

// Running behind Vercel's proxy — required for correct req.ip / rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration (frontend and API are same-origin on Vercel; configurable)
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// ---------------------------------------------------------------------------
// Cached MongoDB connection (safe for serverless: reused across warm invokes)
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crias';

let cached = global._criasMongoose;
if (!cached) cached = global._criasMongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then((m) => {
        logger.info('Connected to MongoDB');
        return m;
      });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow retry on next request
    throw err;
  }
  return cached.conn;
}

// Health check (no DB required) — registered before the DB gate
app.get('/api/health', async (req, res) => {
  let db = 'disconnected';
  try {
    await connectDB();
    db = mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  } catch (e) {
    db = 'error';
  }
  res.json({ status: 'ok', db, timestamp: new Date().toISOString() });
});

// Ensure DB is connected before handling data-backed API routes
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    res.status(503).json({
      type: 'https://httpstatuses.com/503',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Database connection failed'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/firms', firmRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend files (used for local dev; on Vercel the CDN serves these)
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve frontend pages (SPA-style fallback for non-API GET requests)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const page = req.path === '/' ? '/pages/login.html' : req.path;
  res.sendFile(path.join(__dirname, '../frontend', page), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Local development: connect + listen. On Vercel the app is imported as a
// serverless handler and this block never runs.
// ---------------------------------------------------------------------------
if (require.main === module && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  connectDB()
    .then(() => {
      app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      logger.error('Startup MongoDB connection error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
module.exports.connectDB = connectDB;
