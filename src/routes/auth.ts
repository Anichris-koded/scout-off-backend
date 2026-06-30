import { Router } from 'express';
import { getChallenge, postToken } from '../controllers/authController';
import { rateLimit } from '../middleware/rateLimit';
import config from '../config';

const router = Router();

const authRateLimit = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
});

router.get('/challenge', authRateLimit, getChallenge);
router.post('/token', authRateLimit, postToken);

export default router;
