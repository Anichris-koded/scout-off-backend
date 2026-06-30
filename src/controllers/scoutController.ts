import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getEvents } from '../services/indexer';
import { submitContactPayment, PaymentError } from '../services/stellar';
import { pinJson } from '../services/ipfs';
import { ApiResponse } from '../types';

/** GET /api/scouts/:wallet/subscription */
export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const subs = getEvents('scout_subscribed').filter((e) => e.payload.scout === wallet);
    const latest = subs.at(-1);
    res.json({ success: true, data: latest?.payload ?? null });
  } catch (err) {
    next(err);
  }
}

/** GET /api/scouts/:wallet/contacts */
export async function getUnlockedContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const contacts = getEvents('contact_unlocked').filter((e) => e.payload.scout === wallet);
    res.json({ success: true, data: contacts.map((e) => e.payload) });
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

export const trialOfferSchema = z.object({
  playerId: z.string().min(1),
  detailsUri: z.string().min(1),
});

/**
 * POST /api/scouts/trial-offer
 *
 * Records a trial offer on-chain (Elite Tier promotion for the player).
 * The authenticated scout's wallet is read from req.account — set by the
 * requireAuth middleware — without any (req as any) cast.
 */
export async function submitTrialOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const scout = req.account; // typed as string | undefined via Request augmentation
    if (!scout) {
      res.status(401).json({ success: false, error: 'Missing auth token' });
      return;
    }

    const { playerId, detailsUri } = trialOfferSchema.parse(req.body);

    // Pin the offer details to IPFS and record the offer event.
    const offerCid = await pinJson({ scout, playerId, detailsUri });

    const body: ApiResponse<{ offerCid: string }> = {
      success: true,
      data: { offerCid },
    };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}
