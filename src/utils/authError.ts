import { Response } from 'express';

export interface AuthErrorPayload {
  success: false;
  errorCode: number;
  error: string;
  reason?: Record<string, unknown>;
}

/**
 * Sends a standardised 401 Unauthorized JSON response.
 * errorCode 9 = Unauthorized (matches contract error codes).
 */
export function sendUnauthorized(
  res: Response,
  message: string,
  reason?: Record<string, unknown>,
): void {
  const body: AuthErrorPayload = { success: false, errorCode: 9, error: message };
  if (reason !== undefined) body.reason = reason;
  res.status(401).json(body);
}

/**
 * Sends a standardised 403 Forbidden JSON response.
 * errorCode 9 = Unauthorized (matches contract error codes).
 */
export function sendForbidden(
  res: Response,
  message: string,
  reason?: Record<string, unknown>,
): void {
  const body: AuthErrorPayload = { success: false, errorCode: 9, error: message };
  if (reason !== undefined) body.reason = reason;
  res.status(403).json(body);
}
