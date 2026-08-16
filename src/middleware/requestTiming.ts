import type { Request, Response, NextFunction } from 'express';

function skipPath(path: string): boolean {
  return path === '/health' || path.startsWith('/health');
}

/** Logs method, path, status, totalMs for every API request. */
export function requestTiming(req: Request, res: Response, next: NextFunction) {
  if (skipPath(req.path)) return next();

  const started = Date.now();
  res.on('finish', () => {
    const totalMs = Date.now() - started;
    const path = (req.originalUrl ?? req.path).split('?')[0];
    console.log(`[timing] ${req.method} ${path} ${res.statusCode} ${totalMs}ms`);
  });

  next();
}
