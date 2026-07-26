import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { postLogin, postLogout, getMe } from '../controllers/authController.js';
import { ipRateKey } from '../utils/ipKey.js';

const router = Router();

// Strengeres Limit gegen Brute-Force am Login. Pro Anschluss (vor dem Login gibt es noch keine
// Session); etwas höher, da im Gemeinde-WLAN mehrere Erst-Anmeldungen über EINE öffentliche IP
// laufen. Schlüssel über `ipRateKey`: IPv6 wird auf das /64-Netz zusammengefasst (#146) – mit der
// rohen Adresse hätte ein Angreifer pro Adresse seines /64 ein frisches Kontingent, die Bremse vor
// den ChurchTools-Zugangsdaten wäre praktisch wirkungslos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipRateKey(req.ip),
  message: { error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' },
});

router.post('/login', loginLimiter, asyncHandler(postLogin));
router.post('/logout', asyncHandler(postLogout));
router.get('/me', asyncHandler(getMe));

export default router;
