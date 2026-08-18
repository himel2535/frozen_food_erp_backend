import type { Request, Response } from 'express';
import { formatTimingLegs } from '../utils/timing.js';

/** PERF_TRACE — request-scoped timing legs for dev measurement. */

export type PerfTraceLegs = {
  auth?: number;
  handler?: number;
  mongo?: number;
  redis?: number;
  cacheInvalidate?: number;
};

export type PerfTraceState = {
  started: number;
  legs: PerfTraceLegs;
};

declare module 'express-serve-static-core' {
  interface Request {
    perfTrace?: PerfTraceState;
  }
}

export function isPerfTraceEnabled(): boolean {
  return process.env.PERF_TRACE === '1';
}

export function initPerfTrace(req: Request): void {
  if (!isPerfTraceEnabled()) return;
  req.perfTrace = { started: Date.now(), legs: {} };
}

export function markPerfLeg(req: Request, leg: keyof PerfTraceLegs, ms: number): void {
  if (!req.perfTrace) return;
  req.perfTrace.legs[leg] = (req.perfTrace.legs[leg] ?? 0) + ms;
}

export async function timePerfLeg<T>(
  req: Request,
  leg: keyof PerfTraceLegs,
  fn: () => Promise<T>,
): Promise<T> {
  if (!req.perfTrace) return fn();
  const started = Date.now();
  try {
    return await fn();
  } finally {
    markPerfLeg(req, leg, Date.now() - started);
  }
}

export function attachPerfTraceHeader(req: Request, res: Response): void {
  if (!isPerfTraceEnabled() || !req.perfTrace) return;
  res.on('finish', () => {
    writePerfTraceHeader(req, res);
  });
}

export function writePerfTraceHeader(req: Request, res: Response): void {
  if (!isPerfTraceEnabled() || !req.perfTrace || res.headersSent) return;
  const totalMs = Date.now() - req.perfTrace.started;
  const parts = formatTimingLegs({ ...req.perfTrace.legs, total: totalMs });
  res.setHeader('X-Perf-Trace', parts);
}
