import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getServices,
  getSetlist,
  markSetlistSeen,
  postVersion,
  putVersion,
  deleteVersionCtrl,
  getFile,
  putAgendaOrder,
  deleteAgendaItemCtrl,
  putAgendaItem,
  putAgendaItemHidden,
  postAgendaItem,
  getSongs,
  getSongArrangementsCtrl,
  getSongLibraryCtrl,
  getSongChartCtrl,
  getSongUsageCtrl,
  getCapabilitiesCtrl,
  getAgendaServicesCtrl,
} from '../controllers/setlistController.js';

const router = Router();

// Alle Setlist-Routen erfordern eine Session
router.use(requireSession);
router.get('/services', asyncHandler(getServices));
router.get('/services/:eventId/setlist', asyncHandler(getSetlist));
router.post('/services/:eventId/seen', asyncHandler(markSetlistSeen));
router.get('/songs', asyncHandler(getSongs));
router.get('/song-library', asyncHandler(getSongLibraryCtrl));
router.get('/song-usage', asyncHandler(getSongUsageCtrl));
router.get('/capabilities', asyncHandler(getCapabilitiesCtrl));
router.get('/agenda-services', asyncHandler(getAgendaServicesCtrl));
router.get('/songs/:songId/arrangements', asyncHandler(getSongArrangementsCtrl));
router.get('/songs/:songId/chart', asyncHandler(getSongChartCtrl));
router.patch('/services/:eventId/agenda/order', asyncHandler(putAgendaOrder));
router.post('/services/:eventId/agenda/items', asyncHandler(postAgendaItem));
router.put('/services/:eventId/agenda/items/:itemId', asyncHandler(putAgendaItem));
router.put('/services/:eventId/agenda/items/:itemId/hidden', asyncHandler(putAgendaItemHidden));
router.delete('/services/:eventId/agenda/items/:itemId', asyncHandler(deleteAgendaItemCtrl));
router.post('/songs/:songId/versions', asyncHandler(postVersion));
router.put('/songs/:songId/versions/:versionKey', asyncHandler(putVersion));
router.delete('/songs/:songId/versions/:versionKey', asyncHandler(deleteVersionCtrl));
router.get('/songs/:songId/files/:fileId', asyncHandler(getFile));

export default router;
