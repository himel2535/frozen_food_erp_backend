import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { apiRouter } from './routes/api.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.corsOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProd) {
    app.use(morgan('dev'));
  }

  app.get('/', (_req, res) => {
    res.json({
      name: 'Toys Factory ERP Backend',
      version: '1.0.0',
      docs: '/api/v1',
      health: '/health',
    });
  });

  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1', requireAuth, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
