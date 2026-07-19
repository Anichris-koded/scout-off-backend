import { Router } from 'express';
import { getSubscription, getUnlockedContacts, getContactDetails, unlockContact, getPaymentHistory, subscribe, renewSubscription, cancelSubscription, submitTrialOffer, listTrialOffers, createTrialOffer, trialOfferSchema, unlockContactSchema } from '../controllers/scoutController';
import { getScoutRecommendations } from '../controllers/scoutRecommendationsController';
import { requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { walletRateLimit } from '../middleware/rateLimit';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

const router = Router();

/**
 * GET /api/scouts/:wallet/subscription
 *
 * Returns the active subscription status for a scout wallet.
 * Response includes a `gracePeriodActive` boolean field.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: { active, tier, expiresAt, remainingDays, gracePeriodActive } }
 * @response 401 { success: false, error: string } - Missing or invalid token
 * @auth Bearer (scout role required)
 */
router.route('/:wallet/subscription')
  .get(requireRole('scout'), getSubscription)
  .all(methodNotAllowed(['GET', 'HEAD']));

/**
 * POST /api/scouts/:wallet/subscribe
 *
 * Purchase a new scout subscription.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body { tier: 'basic' | 'premium', duration: number (1–365 days) }
 * @header Idempotency-Key {string} - Optional. Ensures safe retries: duplicate keys return
 *   the cached response for 24 hours without triggering a new on-chain transaction.
 * @response 201 { success: true, data: { transactionId, tier, expiresAt, status } }
 * @response 400 { success: false, error: string } - Invalid tier or duration
 * @response 402 { success: false, error: string } - Insufficient XLM balance
 * @response 403 { success: false, error: string } - Scout role required or wallet mismatch
 * @auth Bearer (scout role required)
 *
 * PUT /api/scouts/:wallet/subscribe
 *
 * Renew or create a subscription.
 * If an existing subscription exists, extends its expiry by `duration` days.
 * If no subscription exists, behaves like POST (creates a new one).
 *
 * @param wallet {string} - Scout's Stellar public key
 * @body { tier: 'basic' | 'premium', duration: number (1–365 days) }
 * @response 200 { success: true, data: { transactionId, tier, expiresAt, status } } - Renewal
 * @response 201 { success: true, data: { transactionId, tier, expiresAt, status } } - New subscription
 * @response 400 { success: false, error: string } - Invalid tier or duration
 * @response 402 { success: false, error: string } - Insufficient XLM balance
 * @response 403 { success: false, error: string } - Scout role required or wallet mismatch
 * @auth Bearer (scout role required)
 *
 * DELETE /api/scouts/:wallet/subscribe
 *
 * Cancel an active subscription. Records cancellation on-chain and locally.
 *
 * @param wallet {string} - Scout's Stellar public key
 * @response 200 { success: true, data: { transactionId, cancelledAt, wallet } }
 * @response 403 { success: false, error: string } - Scout role required or wallet mismatch
 * @response 404 { success: false, error: string } - No active subscription found
 * @auth Bearer (scout role required)
 */
router.route('/:wallet/subscribe')
  .post(requireRole('scout'), walletRateLimit(), subscribe)
  .put(requireRole('scout'), walletRateLimit(), renewSubscription)
  .delete(requireRole('scout'), cancelSubscription)
  .all(methodNotAllowed(['POST', 'PUT', 'DELETE']));

/**
 * GET /api/scouts/:wallet/contacts
 *
 * GET /api/scouts/:wallet/contacts/:playerId
 */
router.route('/:wallet/contacts')
  .get(requireRole('scout'), getUnlockedContacts)
  .all(methodNotAllowed(['GET', 'HEAD']));

router.route('/:wallet/contacts/:playerId')
  .get(requireRole('scout'), getContactDetails)
  .all(methodNotAllowed(['GET', 'HEAD']));

/**
 * POST /api/scouts/:wallet/contacts/:playerId/unlock
 */
router.route("/:wallet/contacts/:playerId/unlock")
  .post(
    requireRole("scout"),
    walletRateLimit(),
    validateBody(unlockContactSchema),
    unlockContact,
  )
  .all(methodNotAllowed(['POST']));

router.route('/:wallet/payments')
  .get(requireRole('scout'), getPaymentHistory)
  .all(methodNotAllowed(['GET', 'HEAD']));

/**
 * POST /api/scouts/:wallet/trial-offer
 */
router.route('/:wallet/trial-offer')
  .post(
    requireRole('scout'),
    validateBody(trialOfferSchema),
    submitTrialOffer,
  )
  .all(methodNotAllowed(['POST']));

/**
 * GET /api/scouts/:wallet/trial-offers
 * POST /api/scouts/:wallet/trial-offers
 *
 * On-chain trial offer event log (#285): submits (and lists) trial offers
 * indexed locally by tx_hash. Distinct from the singular /trial-offer stub
 * endpoint above and from the accept/reject workflow in trialOfferController.
 */
router.route('/:wallet/trial-offers')
  .get(requireRole('scout'), listTrialOffers)
  .post(
    requireRole('scout'),
    validateBody(trialOfferSchema),
    createTrialOffer,
  )
  .all(methodNotAllowed(['GET', 'POST', 'HEAD']));

/**
 * GET /api/scouts/:wallet/recommendations
 */
router.route('/:wallet/recommendations')
  .get(
    requireRole('scout'),
    getScoutRecommendations,
  )
  .all(methodNotAllowed(['GET', 'HEAD']));

export default router;
