import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/api.ts';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
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
    // Initialize Vite dev middleware asynchronously so port 3000 binds immediately
    let viteMiddleware: express.RequestHandler | null = null;
    const viteReady = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
          watch: process.env.DISABLE_HMR === 'true' ? null : {},
        },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
      return vite;
    })();

    viteReady.catch(err => {
      console.error('Failed to initialize Vite dev middleware:', err);
      process.exit(1);
    });

    app.use(async (req, res, next) => {
      try {
        if (!viteMiddleware) {
          await viteReady;
        }
        viteMiddleware!(req, res, next);
      } catch (err) {
        next(err);
      }
    });
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

  httpServer.on('error', err => {
    console.error('HTTP server error:', err);
    process.exit(1);
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`High Quality Cafe Server (${isProd ? 'production' : 'development'}) running at http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
