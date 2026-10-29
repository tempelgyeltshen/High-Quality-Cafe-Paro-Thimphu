import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/api.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');

  // Standard HTTP security headers (iframe-compatible for AI Studio preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });

  app.use(express.json({ limit: '256kb' }));

  // Clean JSON error response for malformed JSON bodies (prevents stack trace leaks)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      res.status(400).json({ error: 'Malformed JSON request payload' });
      return;
    }
    if (err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request payload exceeds maximum allowed size (256 KB)' });
      return;
    }
    next(err);
  });

  // Serve dish & hero image assets referenced via /src/assets/images/* in both dev and production
  const srcAssetsPath = path.resolve(__dirname, 'src', 'assets');
  app.use(
    '/src/assets',
    express.static(srcAssetsPath, {
      maxAge: isProd ? '7d' : 0,
      immutable: isProd
    })
  );

  // Mount API endpoints
  app.use('/api', apiRouter);

  if (!isProd) {
    // Development mode with Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '1d',
        index: false
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`High Quality Cafe Server (${isProd ? 'production' : 'development'}) running at http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
