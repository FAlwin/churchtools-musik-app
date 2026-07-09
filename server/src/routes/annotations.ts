import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getAnnotations,
  putAnnotation,
  deleteAnnotation,
} from '../controllers/annotationsController.js';
import {
  getSharedAnnotations,
  putSharedAnnotation,
  deleteSharedAnnotation,
} from '../controllers/sharedAnnotationsController.js';
import { getSettings, putSettings } from '../controllers/userSettingsController.js';

const router = Router();

router.use(requireSession);
router.get('/annotations', asyncHandler(getAnnotations));
// Globale (Team-)Anmerkungen – VOR den generischen `:key`-Routen registrieren.
router.get('/annotations/shared', asyncHandler(getSharedAnnotations));
router.put('/annotations/shared/:key', asyncHandler(putSharedAnnotation));
router.delete('/annotations/shared/:key', asyncHandler(deleteSharedAnnotation));
router.put('/annotations/:key', asyncHandler(putAnnotation));
router.delete('/annotations/:key', asyncHandler(deleteAnnotation));
router.get('/settings', asyncHandler(getSettings));
router.put('/settings', asyncHandler(putSettings));

export default router;
