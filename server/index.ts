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

// Initialize database schema and demo user
initDatabase();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/categories', categoriesRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// In production, serve frontend build
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.use((req, res) => {
  // If request starts with /api, return 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SubTrack Backend API running on http://localhost:${PORT}`);
  });
}

export default app;
