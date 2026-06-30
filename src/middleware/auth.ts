import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { JwtPayload } from '../types';
import { logAuditEvent } from '../services/audit';

export interface AuthPayload extends jwt.JwtPayload, Partial<JwtPayload> {}

/** Extract the client IP from the request (handles proxies via x-forwarded-for). */
function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Middleware that verifies any valid JWT Bearer token.
 * Attaches `req.account` (Stellar public key) and `req.role` on success.
 * Returns 401 if the token is missing or invalid.
 * All 401 responses are persisted to the audit trail.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    const reason = 'Missing auth token';
    console.warn({ method: req.method, path: req.path, error: reason });
    logAuditEvent({
      action: 'auth_failed',
      timestamp: new Date().toISOString(),
      ip: getIp(req),
      path: req.path,
      reason,
    });
    res.status(401).json({ success: false, error: reason });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
    (req as any).account = payload.sub;
    (req as any).role = payload.role;
    next();
  } catch {
    const reason = 'Invalid or expired token';
    console.warn({ method: req.method, path: req.path, error: reason });
    logAuditEvent({
      action: 'auth_failed',
      timestamp: new Date().toISOString(),
      ip: getIp(req),
      path: req.path,
      reason,
    });
    res.status(401).json({ success: false, error: reason });
  }
}

/**
 * Middleware guard that restricts access to a single role.
 *
 * Usage: router.get('/admin-only', requireRole('admin'), handler)
 *
 * Returns 401 if no valid token is present.
 * Returns 403 if the token's role does not match.
 * All 401 and 403 responses are persisted to the audit trail.
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      const reason = 'Missing auth token';
      console.warn({ method: req.method, path: req.path, error: reason, requiredRole: role });
      logAuditEvent({
        action: 'auth_failed',
        timestamp: new Date().toISOString(),
        ip: getIp(req),
        path: req.path,
        requiredRole: role,
        reason,
      });
      res.status(401).json({ success: false, error: reason });
      return;
    }
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
      if (payload.role !== role) {
        const reason = 'Insufficient permissions';
        console.warn({
          method: req.method,
          path: req.path,
          error: reason,
          requiredRole: role,
          providedRole: payload.role,
        });
        logAuditEvent({
          action: 'auth_forbidden',
          timestamp: new Date().toISOString(),
          ip: getIp(req),
          path: req.path,
          wallet: payload.sub ?? null,
          requiredRole: role,
          providedRole: payload.role ?? null,
          reason,
        });
        res.status(403).json({ success: false, error: reason });
        return;
      }
      (req as any).account = payload.sub;
      (req as any).role = payload.role;
      next();
    } catch {
      const reason = 'Invalid or expired token';
      console.warn({ method: req.method, path: req.path, error: reason, requiredRole: role });
      logAuditEvent({
        action: 'auth_failed',
        timestamp: new Date().toISOString(),
        ip: getIp(req),
        path: req.path,
        requiredRole: role,
        reason,
      });
      res.status(401).json({ success: false, error: reason });
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
      res.status(401).json({ success: false, error: 'Missing auth token' });
      return;
    }
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
      if (!payload.role || !roles.includes(payload.role)) {
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }
      (req as any).account = payload.sub;
      (req as any).role = payload.role;
      next();
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  };
}
