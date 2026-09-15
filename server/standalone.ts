import path from 'path';
import express from 'express';
import app from './index';

const PORT = process.env.PORT || 5000;
const distPath = path.resolve(__dirname, '../dist');

// Serve static frontend assets when running locally in production mode
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

app.listen(PORT, () => {
  console.log(`🚀 SubTrack Backend API running on http://localhost:${PORT}`);
});
