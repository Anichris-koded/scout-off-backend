import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      account?: string;
      role?: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers?.['x-correlation-id'] as string) || randomUUID();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}
