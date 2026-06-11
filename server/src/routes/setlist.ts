import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getServices,
  getSetlist,
  putChordpro,
  deleteChordpro,
  getFile,
} from '../controllers/setlistController.js';

const router = Router();

// Alle Setlist-Routen erfordern eine Session
router.use(requireSession);
router.get('/services', asyncHandler(getServices));
router.get('/services/:eventId/setlist', asyncHandler(getSetlist));
router.put('/songs/:songId/chordpro', asyncHandler(putChordpro));
router.delete('/songs/:songId/chordpro', asyncHandler(deleteChordpro));
router.get('/songs/:songId/files/:fileId', asyncHandler(getFile));

export default router;
