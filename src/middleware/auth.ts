import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { JwtPayload } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/authError';

export interface AuthPayload extends jwt.JwtPayload, Partial<JwtPayload> {}

/**
 * Middleware that verifies any valid JWT Bearer token.
 * Attaches `req.account` (Stellar public key) and `req.role` on success.
 * Returns 401 if the token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    console.warn({ method: req.method, path: req.path, error: 'Missing auth token' });
    sendUnauthorized(res, 'Missing auth token');
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
    (req as any).account = payload.sub;
    (req as any).role = payload.role;
    next();
  } catch {
    console.warn({ method: req.method, path: req.path, error: 'Invalid or expired token' });
    sendUnauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Middleware guard that restricts access to a single role.
 *
 * Usage: router.get('/admin-only', requireRole('admin'), handler)
 *
 * Returns 401 if no valid token is present.
 * Returns 403 if the token's role does not match.
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      console.warn({ method: req.method, path: req.path, error: 'Missing auth token', requiredRole: role });
      sendUnauthorized(res, 'Missing auth token');
      return;
    }

    try {
      const token = header.slice(7);
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      
      if (payload.role !== role) {
        console.warn({
          method: req.method,
          path: req.path,
          error: 'Insufficient permissions',
          requiredRole: role,
          providedRole: payload.role,
        });
        sendForbidden(res, 'Insufficient permissions', { requiredRole: role, providedRole: payload.role });
        return;
      }

      (req as any).account = payload.sub;
      (req as any).role = payload.role;
      next();
    } catch {
      console.warn({ method: req.method, path: req.path, error: 'Invalid or expired token', requiredRole: role });
      sendUnauthorized(res, 'Invalid or expired token');
    }
  };
}

/**
 * Middleware guard that allows access to any one of the specified roles.
 * Use this when a route should be accessible to multiple roles.
 *
 * Usage: router.get('/route', requireRoles('admin', 'validator'), handler)
 *
 * Returns 401 if no valid token is present.
 * Returns 403 if the token's role is not in the allowed list.
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      sendUnauthorized(res, 'Missing auth token');
      return;
    }
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
      if (!payload.role || !roles.includes(payload.role)) {
        sendForbidden(res, 'Insufficient permissions');
        return;
      }
      (req as any).account = payload.sub;
      (req as any).role = payload.role;
      next();
    } catch {
      sendUnauthorized(res, 'Invalid or expired token');
    }
  };
}
