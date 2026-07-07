import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { postLogin, postLogout, getMe } from '../controllers/authController.js';

const router = Router();

// Strengeres Limit gegen Brute-Force am Login. Pro IP (vor dem Login gibt es noch keine Session);
// etwas höher, da im Gemeinde-WLAN mehrere Erst-Anmeldungen über EINE öffentliche IP laufen.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' },
});

router.post('/login', loginLimiter, asyncHandler(postLogin));
router.post('/logout', asyncHandler(postLogout));
router.get('/me', asyncHandler(getMe));

export default router;
