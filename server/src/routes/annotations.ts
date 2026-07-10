import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getAnnotations,
  putAnnotation,
  deleteAnnotation,
} from '../controllers/annotationsController.js';
import {
  getSharing,
  putSharing,
  getSharers,
  getAnnotationsOf,
  getSettingsOf,
} from '../controllers/teamNotesController.js';
import { getSettings, putSettings } from '../controllers/userSettingsController.js';

const router = Router();

router.use(requireSession);
router.get('/annotations', asyncHandler(getAnnotations));
// Team-Notizen (PCO-Modell: teilen + fremde geteilte Ebenen lesen) – VOR den `:key`-Routen.
router.get('/annotations/sharing', asyncHandler(getSharing));
router.put('/annotations/sharing', asyncHandler(putSharing));
router.get('/annotations/sharers', asyncHandler(getSharers));
router.get('/annotations/of/:personId', asyncHandler(getAnnotationsOf));
router.put('/annotations/:key', asyncHandler(putAnnotation));
router.delete('/annotations/:key', asyncHandler(deleteAnnotation));
router.get('/settings', asyncHandler(getSettings));
router.get('/settings/of/:personId', asyncHandler(getSettingsOf));
router.put('/settings', asyncHandler(putSettings));

export default router;
