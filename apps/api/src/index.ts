import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config, ROOT_DIR } from './config.ts';
import { db, initStore, seedItems } from './db/index.ts';
import { authMiddleware } from './middleware/auth.ts';
import { warmEmbeddings } from './providers/embeddings.ts';
import { adminRouter } from './routes/adminRoutes.ts';
import { audioRouter } from './routes/audioRoutes.ts';
import { authRouter } from './routes/authRoutes.ts';
import { meRouter } from './routes/meRoutes.ts';
import { sessionRouter } from './routes/sessionRoutes.ts';
import { cleanupExpiredAudio } from './services/audioService.ts';

async function bootstrap() {
  await initStore();

  // Ensure all seed items are upserted into store on startup
  const { inserted } = await seedItems(false);
  const itemCount = await db().items.count({ status: 'live' });
  if (inserted > 0) {
    console.log(`[bootstrap] seeded ${inserted} new items. Item bank ready with ${itemCount} items.`);
  } else {
    console.log(`[bootstrap] item bank ready with ${itemCount} items.`);
  }

  // Warm embedding pipeline in background
  warmEmbeddings();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers (allow audio streaming & cross-origin credentials)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS configuration
  const normalizedOrigins = config.clientOrigins.map((o) => o.replace(/\/$/, ''));
  const hasExplicitOrigins = Boolean(process.env.CLIENT_ORIGIN?.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (!config.isProd || !hasExplicitOrigins || normalizedOrigins.includes('*') || normalizedOrigins.includes(cleanOrigin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // General rate limit: 120 requests per minute
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Too many requests. Please slow down.' } },
  });
  app.use('/api', apiLimiter);

  // Global user context middleware
  app.use(authMiddleware);

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/sessions', sessionRouter);
  app.use('/api/audio', audioRouter);
  app.use('/api/me', meRouter);
  app.use('/api/admin', adminRouter);

  // Health check endpoint (for warm-up ping and uptime monitoring, spec 14 & 26)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'fluentpath-api', timestamp: new Date().toISOString() });
  });

  // Serve built web app in single-service production deployments when dist/ exists
  const webDistDir = path.join(ROOT_DIR, 'apps', 'web', 'dist');
  const webIndexFile = path.join(webDistDir, 'index.html');
  if (fs.existsSync(webIndexFile)) {
    app.use(express.static(webDistDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && req.path !== '/health') {
        return res.sendFile(webIndexFile);
      }
      return next();
    });
    console.log(`[bootstrap] serving web frontend from ${webDistDir}`);
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred.',
      },
    });
  });

  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`[fluentpath-api] listening on http://localhost:${config.port}`);
  });

  // Daily retention cleaner for audio recordings
  setInterval(() => {
    cleanupExpiredAudio().catch((err) => console.error('[cleanup] error:', err));
  }, 24 * 3600 * 1000);
}

bootstrap().catch((err) => {
  console.error('[fatal] bootstrap failed:', err);
  process.exit(1);
});
