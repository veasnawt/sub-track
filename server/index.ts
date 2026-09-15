import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './db';
import authRouter from './routes/auth';
import subscriptionsRouter from './routes/subscriptions';
import analyticsRouter from './routes/analytics';
import categoriesRouter from './routes/categories';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database schema and demo user safely
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

// Path Normalizer: Ensures Vercel Serverless Rewrites and catch-alls preserve subpaths
app.use((req, res, next) => {
  if (req.query && (req.query.match || req.query.path)) {
    const raw = req.query.match || req.query.path;
    const subpath = Array.isArray(raw) ? raw.join('/') : String(raw);
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

// API Routes - mounted for both /api/* and direct /*
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/subscriptions', subscriptionsRouter);
app.use('/subscriptions', subscriptionsRouter);

app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);

app.use('/api/categories', categoriesRouter);
app.use('/categories', categoriesRouter);

// Health check endpoint
app.get(['/api/health', '/health', '/api', '/api/'], (req, res) => {
  res.json({ status: 'ok', service: 'SubTrack API', time: new Date().toISOString() });
});

// In local standalone mode (not Vercel), serve built static frontend assets
if (!process.env.VERCEL) {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));

  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      return res.status(404).json({ success: false, error: `Endpoint ${req.path} not found` });
    }
    const indexHtml = path.join(distPath, 'index.html');
    res.sendFile(indexHtml, (err) => {
      if (err) {
        res.status(200).send(`
          <html>
            <body style="font-family:sans-serif;padding:2rem;text-align:center;">
              <h2>SubTrack Server is running!</h2>
              <p>Vite dev server runs at <a href="http://localhost:3000">http://localhost:3000</a></p>
            </body>
          </html>
        `);
      }
    });
  });
} else {
  // In Vercel serverless mode, all unmatched requests to Express return clean JSON 404
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Endpoint ${req.path} not found` });
  });
}

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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SubTrack Backend API running on http://localhost:${PORT}`);
  });
}

export default app;
