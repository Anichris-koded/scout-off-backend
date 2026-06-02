import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId: string | undefined = (req as any).correlationId;

  logger.error(`[error] ${err.message}${correlationId ? ` correlationId=${correlationId}` : ''}`);

  if (err instanceof ZodError) {
    const body: ApiResponse & { correlationId?: string } = {
      success: false,
      error: err.errors[0]?.message ?? 'Validation error',
      ...(correlationId !== undefined && { correlationId }),
    };
    res.status(400).json(body);
    return;
  }

  const body: ApiResponse & { correlationId?: string } = {
    success: false,
    error: err.message,
    ...(correlationId !== undefined && { correlationId }),
  };
  res.status(500).json(body);
}
