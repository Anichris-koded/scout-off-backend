import { Router } from 'express';
import { getAllEvents, getFeeSummary, registerValidator, revokeValidator } from '../controllers/adminController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/stats', requireRole('admin'), getStats);
router.get('/events', requireAuth, getAllEvents);
router.get('/fees', requireAuth, getFeeSummary);
router.post('/validators/register', requireRole('admin'), registerValidator);
router.post('/validators/revoke', requireRole('admin'), revokeValidator);

export default router;
