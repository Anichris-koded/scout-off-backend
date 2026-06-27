import { Router } from 'express';
import { getSubscription, getUnlockedContacts, unlockContact, getPaymentHistory, subscribe } from '../controllers/scoutController';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSubscription, getUnlockedContacts, unlockContact, getPaymentHistory } from '../controllers/scoutController';
import { requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/scouts/:wallet/subscription
 *
 * Returns the active subscription status for a scout wallet.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: { active: boolean, tier: string, expiresAt: string } }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (any authenticated user)
 */
router.get('/:wallet/subscription', requireRole('scout'), getSubscription);

/**
 * POST /api/scouts/:wallet/subscribe
 *
 * Purchase a scout subscription by invoking subscribe(scout, tier, duration) on-chain.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body { tier: 'basic' | 'premium', duration: number (1–365 days) }
 * @response 201 { success: true, data: { transactionId, tier, expiresAt, status } }
 * @response 400 { success: false, error: string } - Invalid tier or duration
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @response 402 { success: false, error: string } - Insufficient XLM balance
 * @response 403 { success: false, error: string } - Scout role required
 * @auth Bearer (scout role required)
 */
router.post('/:wallet/subscribe', requireRole('scout'), subscribe);

/**
 * GET /api/scouts/:wallet/contacts
 *
 * Returns the list of player contacts unlocked by this scout.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: Contact[] }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (any authenticated user)
 */
router.get('/:wallet/contacts', requireRole('scout'), getUnlockedContacts);

/**
 * POST /api/scouts/:wallet/contacts/:playerId/unlock
 *
 * Records a pay-to-contact unlock for a player. The on-chain payment must be
 * completed via the Soroban pay_to_contact function before calling this endpoint.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @param playerId {string} - Target player's on-chain identifier
 * @response 200 { success: true, data: Contact }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (any authenticated user)
 */
router.post('/:wallet/contacts/:playerId/unlock', requireRole('scout'), unlockContact);
router.get('/:wallet/payments', requireRole('scout'), getPaymentHistory);

/**
 * POST /api/scouts/:wallet/trial-offer
 *
 * Logs an immutable on-chain trial offer for a player, promoting them to
 * Elite Tier (Level 3). The scout must hold an active subscription or have
 * previously paid the contact fee for this player.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body playerId {string} - Target player's on-chain identifier
 * @body detailsUri {string} - IPFS (ipfs://) or HTTPS URI of the offer terms document
 * @response 201 { success: true, data: { transactionId, playerId, detailsUri, playerTier } }
 * @response 400 { success: false, error: string } - Missing playerId or invalid detailsUri
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @response 402 { success: false, error: string } - Scout must be subscribed or have paid the contact fee
 * @response 403 { success: false, error: string } - Scout role required, or wallet mismatch
 * @response 404 { success: false, error: string } - Player not found
 * @auth Bearer (scout role)
 */
router.post('/:wallet/trial-offer', requireRole('scout'), validateBody(trialOfferSchema), submitTrialOffer);

export default router;
