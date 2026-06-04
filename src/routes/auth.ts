import { Router } from 'express';
import { getChallenge, postToken } from '../controllers/authController';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.get('/challenge', rateLimit(), getChallenge);
router.post('/token', rateLimit(), postToken);

export default router;
