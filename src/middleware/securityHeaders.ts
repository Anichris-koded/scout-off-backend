import { Request, Response, NextFunction } from 'express';
import config from '../config';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const h = config.securityHeaders;
  res.setHeader('Strict-Transport-Security', h.hsts);
  res.setHeader('X-Content-Type-Options', h.xContentTypeOptions);
  res.setHeader('X-Frame-Options', h.xFrameOptions);
  res.setHeader('Referrer-Policy', h.referrerPolicy);
  next();
}
