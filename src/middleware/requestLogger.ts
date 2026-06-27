import { Request, Response, NextFunction } from 'express';
import { extractClientIp } from '../utils/ipExtractor';
import { logger } from '../utils/logger';

/**
 * Request logging middleware.
 * Uses extractClientIp to correctly resolve the client IP behind proxies.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const ip = extractClientIp(req);
  const { correlationId } = req;
  logger.info(
    `[request] ${req.method} ${req.path} ip=${ip}${correlationId ? ` correlationId=${correlationId}` : ''}`
  );
  next();
}
