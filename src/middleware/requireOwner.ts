import { Request, Response, NextFunction } from 'express';
import { sendForbidden } from '../utils/authError';

/**
 * Typed helper: returns true when the authenticated account matches the target id.
 */
export function isOwner(account: string | undefined, targetId: string): boolean {
  return !!account && account === targetId;
}

/**
 * Middleware that ensures the authenticated user (JWT sub) matches req.params.playerId.
 * Must be used after requireAuth so that req.account is already set.
 * Returns 403 if the caller is not the profile owner.
 */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const account = (req as any).account as string | undefined;
  const { playerId } = req.params;
  if (!isOwner(account, playerId)) {
    sendForbidden(res, 'Forbidden: not the profile owner');
    return;
  }
  next();
}
