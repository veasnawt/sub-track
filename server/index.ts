import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db';
import authRouter from './routes/auth';
import subscriptionsRouter from './routes/subscriptions';
import analyticsRouter from './routes/analytics';
import categoriesRouter from './routes/categories';

dotenv.config();

const app = express();

// Initialize database schema safely
try {
  initDatabase();
} catch (err) {
  console.error('Database initialization warning:', err);
}

app.use(cors());

// Body handling defense: if body was already parsed by Vercel serverless runtime or an edge layer, mark it so body-parser does not hang
app.use((req: any, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    req._body = true;
  } else if (typeof req.body === 'string' && req.body.length > 0) {
    try {
      req.body = JSON.parse(req.body);
      req._body = true;
    } catch (e) {}
  }
  next();
});

app.use(express.json());

// Path Normalizer: Ensures Vercel Serverless Rewrites preserve subpaths
app.use((req, res, next) => {
  if (req.query && req.query.match) {
    const subpath = Array.isArray(req.query.match) ? req.query.match.join('/') : String(req.query.match);
    if (subpath) {
      const qIndex = req.url.indexOf('?');
      const search = qIndex !== -1 ? req.url.substring(qIndex) : '';
      req.url = `/api/${subpath}${search}`;
    }
  } else {
    const matched = (req.headers['x-matched-path'] as string) || (req.headers['x-now-route-matches'] as string) || (req.headers['x-forwarded-uri'] as string);
    if (matched && matched.startsWith('/api') && (req.url === '/api' || req.url === '/' || req.url === '')) {
      req.url = matched;
    }
  }
  next();
});

// Health check endpoint (accessible at /api/health, /health, /api)
app.get(['/api/health', '/health', '/api', '/api/'], (req, res) => {
  res.json({ status: 'ok', service: 'SubTrack API', time: new Date().toISOString() });
});

// API Routes - mounted for both /api/* and direct /*
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/subscriptions', subscriptionsRouter);
app.use('/subscriptions', subscriptionsRouter);

app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);

app.use('/api/categories', categoriesRouter);
app.use('/categories', categoriesRouter);

// Catch-all for unmatched API routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint ${req.path} not found` });
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(err?.status || err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Internal Server Error',
    });
  }
});

export default app;
