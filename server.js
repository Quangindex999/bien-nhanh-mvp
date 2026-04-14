import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './src/routes/apiRoutes.js';

/* ── Resolve __dirname for ESM ── */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/* ── App bootstrap ── */
const app  = express();
const PORT = process.env.PORT ?? 3000;

/* ── Middleware ── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Static files ── */
app.use(express.static(join(__dirname, 'public')));

/* ── API routes ── */
app.use('/api', apiRoutes);

/* ── Serve Vite production build ── */
app.use(express.static(join(__dirname, 'dist')));

/* ── SPA catch-all: trả về index.html cho mọi route không phải API ── */
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err?.message ?? err);
  res.status(err?.status ?? 500).json({
    success: false,
    message: err?.message ?? 'Internal Server Error',
  });
});

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n🚀 Biến Nhanh server running → http://localhost:${PORT}\n`);
});
