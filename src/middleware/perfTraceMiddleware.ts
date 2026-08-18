import type { Request, Response, NextFunction } from 'express';
import { initPerfTrace, isPerfTraceEnabled, writePerfTraceHeader } from './perfTrace.js';

function skipPath(path: string): boolean {
  return path === '/health' || path.startsWith('/health');
}

/** PERF_TRACE — attaches X-Perf-Trace response header when PERF_TRACE=1. */
export function perfTraceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isPerfTraceEnabled() || skipPath(req.path)) return next();

  initPerfTrace(req);

  const originalEnd = res.end.bind(res);
  res.end = ((...args: Parameters<Response['end']>) => {
    writePerfTraceHeader(req, res);
    return originalEnd(...args);
  }) as typeof res.end;

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    writePerfTraceHeader(req, res);
    return originalJson(body);
  }) as typeof res.json;

  next();
}
