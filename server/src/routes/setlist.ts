import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getServices,
  getSetlist,
  putChordpro,
  deleteChordpro,
  getFile,
  putAgendaOrder,
  deleteAgendaItemCtrl,
  putAgendaItem,
  postAgendaItem,
  getSongs,
  getSongLibraryCtrl,
  getSongChartCtrl,
  getSongUsageCtrl,
} from '../controllers/setlistController.js';

const router = Router();

// Alle Setlist-Routen erfordern eine Session
router.use(requireSession);
router.get('/services', asyncHandler(getServices));
router.get('/services/:eventId/setlist', asyncHandler(getSetlist));
router.get('/songs', asyncHandler(getSongs));
router.get('/song-library', asyncHandler(getSongLibraryCtrl));
router.get('/song-usage', asyncHandler(getSongUsageCtrl));
router.get('/songs/:songId/chart', asyncHandler(getSongChartCtrl));
router.patch('/services/:eventId/agenda/order', asyncHandler(putAgendaOrder));
router.post('/services/:eventId/agenda/items', asyncHandler(postAgendaItem));
router.put('/services/:eventId/agenda/items/:itemId', asyncHandler(putAgendaItem));
router.delete('/services/:eventId/agenda/items/:itemId', asyncHandler(deleteAgendaItemCtrl));
router.put('/songs/:songId/chordpro', asyncHandler(putChordpro));
router.delete('/songs/:songId/chordpro', asyncHandler(deleteChordpro));
router.get('/songs/:songId/files/:fileId', asyncHandler(getFile));

export default router;
