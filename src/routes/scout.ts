import { Router } from 'express';
import { getSubscription, getUnlockedContacts, unlockContact } from '../controllers/scoutController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/:wallet/subscription', requireAuth, getSubscription);
router.get('/:wallet/contacts', requireAuth, getUnlockedContacts);
router.post('/:wallet/contacts/:playerId/unlock', requireAuth, unlockContact);

export default router;
