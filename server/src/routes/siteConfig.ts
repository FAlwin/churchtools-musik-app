import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession, requireAdmin } from '../middleware/session.js';
import { getSiteConfigCtrl, putSiteConfigCtrl } from '../controllers/siteConfigController.js';

const router = Router();

// Öffentlich: der Login-Screen liest den Gemeinde-Namen ohne Anmeldung.
router.get('/site-config', asyncHandler(getSiteConfigCtrl));

// Schreiben nur für angemeldete Administratoren.
router.put('/site-config', requireSession, asyncHandler(requireAdmin), asyncHandler(putSiteConfigCtrl));

export default router;
