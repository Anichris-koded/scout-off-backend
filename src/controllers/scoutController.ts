import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getEvents } from '../services/indexer';
import {
  insertTrialOffer,
  getTrialOffers,
} from '../services/indexer';
import { invokeContract, strVal } from '../utils/contract';
import { submitContactPayment, PaymentError } from '../services/stellar';
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

const trialOfferSchema = z.object({
  playerId: z.string().min(1),
  detailsUri: z.string().min(1),
});

/** POST /api/scouts/:wallet/trial-offers */
export async function submitTrialOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const { playerId, detailsUri } = trialOfferSchema.parse(req.body);

    const { hash } = await invokeContract('log_trial_offer', [
      strVal(wallet),
      strVal(playerId),
      strVal(detailsUri),
    ]);

    insertTrialOffer(wallet, playerId, detailsUri, hash, Math.floor(Date.now() / 1000));

    res.status(201).json({ success: true, data: { transactionId: hash, playerId, detailsUri } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/scouts/:wallet/trial-offers */
export async function getTrialOfferHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { wallet } = req.params;
    const offers = getTrialOffers(wallet);
    res.json({ success: true, data: offers });
  } catch (err) {
    next(err);
  }
}
