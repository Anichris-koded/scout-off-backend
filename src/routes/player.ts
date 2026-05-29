import { Router } from 'express';
import {
  registerPlayer,
  getPlayer,
  filterPlayers,
  getPlayerMilestones,
  registerSchema,
  filterSchema,
} from '../controllers/playerController';
import { validateBody, validateQuery } from '../middleware/validate';

const router = Router();

router.get('/', validateQuery(filterSchema), filterPlayers);
router.post('/register', validateBody(registerSchema), registerPlayer);
router.get('/:playerId', getPlayer);
router.get('/:playerId/milestones', getPlayerMilestones);

export default router;
