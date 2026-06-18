import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession, requireAdmin } from '../middleware/session.js';
import {
  getSiteConfigCtrl,
  getSiteLogoCtrl,
  getManifestCtrl,
  putSiteConfigCtrl,
} from '../controllers/siteConfigController.js';

const router = Router();

// Öffentlich: der Login-Screen muss das Branding ohne Anmeldung lesen können.
router.get('/site-config', asyncHandler(getSiteConfigCtrl));
router.get('/site-logo', asyncHandler(getSiteLogoCtrl));
router.get('/manifest.webmanifest', asyncHandler(getManifestCtrl));

// Schreiben nur für angemeldete Administratoren.
router.put('/site-config', requireSession, asyncHandler(requireAdmin), asyncHandler(putSiteConfigCtrl));

export default router;
