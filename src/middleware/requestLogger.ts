import { Request, Response, NextFunction } from 'express';
import { extractClientIp } from '../utils/ipExtractor';
import { logger } from '../utils/logger';

function computeRequestBodySize(req: Request): number | undefined {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return undefined;
  }

  const contentType = req.get('content-type') ?? '';
  if (!req.is('json') && !contentType.includes('json')) {
    return undefined;
  }

  const contentLengthHeader = req.get('content-length');
  if (contentLengthHeader) {
    const parsed = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  if (req.body == null) {
    return undefined;
  }

  if (typeof req.body === 'string') {
    return Buffer.byteLength(req.body, 'utf8');
  }

  try {
    return Buffer.byteLength(JSON.stringify(req.body), 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Request logging middleware.
 * Uses extractClientIp to correctly resolve the client IP behind proxies.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const ip = extractClientIp(req);
  const correlationId: string | undefined = (req as any).correlationId;
  logger.info(
    `[request] ${req.method} ${req.path} ip=${ip}${correlationId ? ` correlationId=${correlationId}` : ''}`
  );
  next();
}
