import { Router } from 'express';
import {
  getStats,
  getAllEvents,
  getFeeSummary,
  registerValidator,
  revokeValidator,
  pauseContract,
} from '../controllers/adminController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/stats', requireRole('admin'), getStats);
router.get('/events', requireRole('admin'), getAllEvents);
router.get('/fees', requireRole('admin'), getFeeSummary);
router.post('/validators/register', requireRole('admin'), registerValidator);
router.post('/validators/revoke', requireRole('admin'), revokeValidator);
router.post('/contract/pause', requireRole('admin'), pauseContract);

export default router;
