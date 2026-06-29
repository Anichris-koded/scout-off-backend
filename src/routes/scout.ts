import { Router } from 'express';
import {
  getSubscription,
  getUnlockedContacts,
  unlockContact,
  submitTrialOffer,
  getTrialOfferHistory,
} from '../controllers/scoutController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/:wallet/subscription', requireAuth, getSubscription);
router.get('/:wallet/contacts', requireAuth, getUnlockedContacts);
router.post('/:wallet/contacts/:playerId/unlock', requireAuth, unlockContact);
router.post('/:wallet/trial-offers', requireAuth, submitTrialOffer);
router.get('/:wallet/trial-offers', requireAuth, getTrialOfferHistory);

export default router;
