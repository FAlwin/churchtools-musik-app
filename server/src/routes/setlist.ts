import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import { getServices, getSetlist } from '../controllers/setlistController.js';

const router = Router();

// Alle Setlist-Routen erfordern eine Session
router.use(requireSession);
router.get('/services', asyncHandler(getServices));
router.get('/services/:eventId/setlist', asyncHandler(getSetlist));

export default router;
