import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { isRedisReady } from '../lib/redisClient.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  sendSuccess(res, {
    service: 'toys-factory-erp-backend',
    status: 'ok',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: isRedisReady() ? 'connected' : env.redisUrl ? 'disconnected' : 'not_configured',
    note: 'Firebase remains the live frontend backend until you wire this API in.',
  });
});

healthRouter.get('/ready', (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    database: dbOk ? 'connected' : 'disconnected',
  });
});
