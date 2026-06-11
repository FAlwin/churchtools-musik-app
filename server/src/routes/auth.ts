import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { postLogin, postLogout, getMe } from '../controllers/authController.js';

const router = Router();

// Strengeres Limit gegen Brute-Force am Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' },
});

router.post('/login', loginLimiter, asyncHandler(postLogin));
router.post('/logout', postLogout);
router.get('/me', asyncHandler(getMe));

export default router;
