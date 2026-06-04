import { Request, Response, NextFunction } from 'express';
import { getEvents } from '../services/indexer';
import { submitContactPayment, isSubscribed, PaymentError } from '../services/stellar';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

/** GET /api/scouts/:wallet/subscription */
export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    if ((req as any).account !== wallet) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // On-chain verification stub — falls back to indexed events when stub returns inactive
    const onChain = await isSubscribed(wallet);
    if (onChain.active) {
      res.json({ success: true, data: { active: true, tier: 'basic', expiresAt: onChain.expiresAt, remainingDays: null } });
      return;
    }

    const subs = getEvents('scout_subscribed').filter((e) => e.payload.scout === wallet);
    const latest = subs.at(-1);
    if (!latest) {
      res.json({ success: true, data: { active: false, tier: null, expiresAt: null, remainingDays: 0 } });
      return;
    }
    const expiresAt = latest.payload.subscriptionExpiry as number;
    const now = Math.floor(Date.now() / 1000);
    const active = expiresAt > now;
    const remainingDays = active ? Math.ceil((expiresAt - now) / 86400) : 0;
    res.json({
      success: true,
      data: {
        active,
        tier: (latest.payload.tier as string) ?? 'basic',
        expiresAt,
        remainingDays,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/scouts/:wallet/contacts */
/** GET /api/scouts/:wallet/contacts */
export async function getUnlockedContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { playerId } = req.query as { playerId?: string };

    if ((req as any).account !== wallet) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let contacts = getEvents('contact_unlocked').filter((e) => e.payload.scout === wallet);

    if (playerId) {
      contacts = contacts.filter((e) => e.payload.playerId === playerId);
    }

    res.json({
      success: true,
      data: contacts.map((e) => ({
        playerId: e.payload.playerId as string,
        contact_status: 'unlocked',
        unlockedAt: e.payload.unlockedAt as number,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/scouts/:wallet/contacts/:playerId/unlock */
export async function unlockContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet, playerId } = req.params;
    if (!wallet || !playerId) {
      res.status(400).json({ success: false, error: 'wallet and playerId are required' });
      return;
    }

    // Verify the JWT subject matches the wallet in the path
    if ((req as any).account !== wallet) {
      logger.warn(`[scout] action=unlock_contact_denied scout=${wallet} playerId=${playerId} reason=wallet_mismatch`);
      res.status(403).json({ success: false, error: 'Forbidden: wallet does not match authenticated account' });
      return;
    }

    logger.info(`[scout] action=unlock_contact_attempt scout=${wallet} playerId=${playerId}`);

    const result = await submitContactPayment(wallet, playerId);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PaymentError) {
      res.status(402).json({ success: false, error: err.message, code: err.code });
      return;
    }
    next(err);
  }
}

/** GET /api/scouts/:wallet/payments — placeholder payment history */
export async function getPaymentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };

    // Derive mock history from indexed contact_unlocked events
    let payments = getEvents('contact_unlocked')
      .filter((e) => e.payload.scout === wallet)
      .map((e, i) => ({
        transactionId: (e.payload as any).txHash ?? `mock-tx-${i}`,
        amount: (e.payload as any).fee ?? '0',
        token: 'XLM',
        timestamp: (e.payload as any).timestamp ?? new Date(0).toISOString(),
      }));

    if (from) {
      const fromDate = new Date(from).getTime();
      payments = payments.filter((p) => new Date(p.timestamp).getTime() >= fromDate);
    }
    if (to) {
      const toDate = new Date(to).getTime();
      payments = payments.filter((p) => new Date(p.timestamp).getTime() <= toDate);
    }

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}
