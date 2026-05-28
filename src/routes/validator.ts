import { Router } from 'express';
import {
  submitMilestoneEvidence,
  getPendingMilestones,
  milestoneSchema,
  pendingQuerySchema,
} from '../controllers/validatorController';
import { requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';

const router = Router();

router.post('/milestone', requireRole('validator'), validateBody(milestoneSchema), submitMilestoneEvidence);
router.get('/milestones/pending', requireRole('validator'), validateQuery(pendingQuerySchema), getPendingMilestones);

export default router;
