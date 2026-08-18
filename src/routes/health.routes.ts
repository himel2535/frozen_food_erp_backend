import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { isRedisReady, redisDel, redisGet, redisSet, redisTtl } from '../lib/redisClient.js';
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

/** Dev-only Redis SET/GET/TTL/DEL smoke test — safe, uses erp:health:test key. */
healthRouter.get('/redis-test', async (_req, res) => {
  const testKey = 'erp:health:test';
  const payload = { ok: true, ts: Date.now() };
  const result: Record<string, unknown> = {
    configured: Boolean(env.redisUrl),
    connected: isRedisReady(),
    steps: {} as Record<string, unknown>,
  };

  if (!isRedisReady()) {
    return sendSuccess(res, result);
  }

  await redisSet(testKey, JSON.stringify(payload), 60_000);
  const got = await redisGet(testKey);
  const ttl = await redisTtl(testKey);
  const delOk = await redisDel(testKey);
  const afterDel = await redisGet(testKey);

  result.steps = {
    set: true,
    get: got === JSON.stringify(payload),
    ttlMs: ttl,
    del: delOk,
    afterDel: afterDel === null,
  };
  result.pass = Boolean(
    (result.steps as { get?: boolean }).get
    && (result.steps as { del?: boolean }).del
    && (result.steps as { afterDel?: boolean }).afterDel,
  );

  sendSuccess(res, result);
});
