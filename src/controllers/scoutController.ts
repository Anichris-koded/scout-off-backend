import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getEvents } from '../db';
import { submitContactPayment, isSubscribed, PaymentError } from '../services/stellar';
import { logger } from '../utils/logger';

export const trialOfferSchema = z.object({
  playerId: z.string().min(1),
  detailsUri: z.string().min(1).refine(isValidEvidenceUri, 'detailsUri must be a valid IPFS (ipfs://) or HTTPS URI'),
});

/**
 * Returns true if the scout currently has paid access to the player —
 * either an active subscription or a previously unlocked contact.
 */
async function scoutHasPlayerAccess(scoutWallet: string, playerId: string): Promise<boolean> {
  const onChain = await isSubscribed(scoutWallet);
  if (onChain.active) return true;

  const subs = getEvents('scout_subscribed').filter((e) => e.payload.scout === scoutWallet);
  const latestSub = subs.at(-1);
  if (latestSub) {
    const expiresAt = latestSub.payload.subscriptionExpiry as number;
    if (expiresAt > Math.floor(Date.now() / 1000)) return true;
  }

  return getEvents('contact_unlocked').some(
    (e) => e.payload.scout === scoutWallet && e.payload.playerId === playerId
  );
}

/** GET /api/scouts/:wallet/subscription */
export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    if (req.account !== wallet) {
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
    const expiresAt = latest.payload.subscription_expiry as number;
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
export async function getUnlockedContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { playerId } = req.query as { playerId?: string };

    if (req.account !== wallet) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let contacts = getEvents('contact_unlocked').filter((e) => e.payload.scout === wallet);

    if (playerId) {
      contacts = contacts.filter((e) => e.payload.player_id === playerId);
    }

    res.json({
      success: true,
      data: contacts.map((e) => ({
        playerId: e.payload.player_id as string,
        contact_status: 'unlocked',
        unlockedAt: e.payload.unlocked_at as number,
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
    if (req.account !== wallet) {
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

/** POST /api/scouts/:wallet/trial-offer */
export async function submitTrialOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { playerId, detailsUri } = req.body as { playerId: string; detailsUri: string };

    if ((req as any).account !== wallet) {
      logger.warn(`[scout] action=log_trial_offer_denied scout=${wallet} playerId=${playerId} reason=wallet_mismatch`);
      res.status(403).json({ success: false, error: 'Forbidden: wallet does not match authenticated account' });
      return;
    }

    const playerExists = getEvents('player_registered').some((e) => e.payload.player_id === playerId);
    if (!playerExists) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    const hasAccess = await scoutHasPlayerAccess(wallet, playerId);
    if (!hasAccess) {
      res.status(402).json({
        success: false,
        error: 'Scout must be subscribed or have paid the contact fee for this player',
      });
      return;
    }

    logger.info(`[scout] action=log_trial_offer_attempt scout=${wallet} playerId=${playerId}`);

    const result = await logTrialOffer(wallet, playerId, detailsUri);
    res.status(201).json({ success: true, data: result });
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
        transactionId: (e.payload.tx_hash ?? `mock-tx-${i}`) as string,
        amount: (e.payload.fee ?? '0') as string,
        token: 'XLM',
        timestamp: (e.payload.timestamp ?? new Date(0).toISOString()) as string,
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
