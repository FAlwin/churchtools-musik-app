import express, { Router } from 'express';
import { MAX_FILE_BYTES } from '../services/ctHttp.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getServices,
  getSetlist,
  getSetlistVersion,
  markSetlistSeen,
  postVersion,
  putArrangementTempo,
  putVersion,
  deleteVersionCtrl,
  getFile,
  putAgendaOrder,
  deleteAgendaItemCtrl,
  putAgendaItem,
  putAgendaItemHidden,
  postAgendaItem,
  getSongArrangementsCtrl,
  getSongLibraryCtrl,
  getSongCategoriesCtrl,
  postSong,
  putSong,
  getSongStammdaten,
  deleteSongCtrl,
  getSongChartCtrl,
  getSongUsageCtrl,
  getCapabilitiesCtrl,
  getAgendaServicesCtrl,
  getArrangementFiles,
  postArrangementFile,
  deleteArrangementFileCtrl,
  getSongSelectSearch,
  getSongSelectByNumber,
  postSongSelectChordPro,
} from '../controllers/setlistController.js';

const router = Router();

// Alle Setlist-Routen erfordern eine Session
router.use(requireSession);
router.get('/services', asyncHandler(getServices));
router.get('/services/:eventId/setlist', asyncHandler(getSetlist));
router.get('/services/:eventId/setlist/version', asyncHandler(getSetlistVersion));
router.post('/services/:eventId/seen', asyncHandler(markSetlistSeen));
router.get('/song-library', asyncHandler(getSongLibraryCtrl));
router.get('/song-categories', asyncHandler(getSongCategoriesCtrl));
// Ein neues Lied (#322). Rechte und Doppel-Erkennung prüft der Dienst, nicht die Oberfläche.
router.post('/songs', asyncHandler(postSong));
// Stammdaten ändern und löschen (#322, Schritt 11). Der PUT ist lesen–ändern–schreiben: Ein
// Teil-PUT auf /api/songs/{id} löscht in ChurchTools die nicht gesendeten Felder (gemessen).
// Die Stammdaten eines Liedes lesen (fürs Änderungsformular) …
router.get('/songs/:songId/stammdaten', asyncHandler(getSongStammdaten));
router.put('/songs/:songId', asyncHandler(putSong));
router.delete('/songs/:songId', asyncHandler(deleteSongCtrl));
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
router.put('/songs/:songId/arrangements/:arrangementId/tempo', asyncHandler(putArrangementTempo));
router.post('/songs/:songId/versions', asyncHandler(postVersion));
router.put('/songs/:songId/versions/:versionKey', asyncHandler(putVersion));
router.delete('/songs/:songId/versions/:versionKey', asyncHandler(deleteVersionCtrl));
router.get('/songs/:songId/files/:fileId', asyncHandler(getFile));

/**
 * Dateiverwaltung eines Arrangements (#321).
 *
 * `express.raw` nur HIER: Die Datei kommt als roher Rumpf, nicht als Multipart (Begründung am
 * Controller). Die Grenze ist dieselbe wie beim LESEN von ChurchTools-Dateien – eine zweite Zahl
 * daneben würde irgendwann von der ersten abweichen und Dateien annehmen, die wir nicht wieder
 * ausliefern können.
 */
router.get('/songs/:songId/arrangements/:arrangementId/files', asyncHandler(getArrangementFiles));
router.post(
  '/songs/:songId/arrangements/:arrangementId/files',
  express.raw({ type: '*/*', limit: MAX_FILE_BYTES }),
  asyncHandler(postArrangementFile),
);
router.delete('/songs/:songId/files/:fileId', asyncHandler(deleteArrangementFileCtrl));

/**
 * CCLI SongSelect (#322) – nur lesend. Beide Aufrufe gehen über ChurchTools weiter zu CCLI und
 * dauern spürbar (~800 ms gemessen); sie ändern aber nichts.
 */
router.get('/songselect/search', asyncHandler(getSongSelectSearch));
router.get('/songselect/songs/:songNumber', asyncHandler(getSongSelectByNumber));
// Der einzige SCHREIBENDE SongSelect-Weg: holt das Notenblatt ins Arrangement und ersetzt dabei ein
// vorhandenes Original-ChordPro (pro Arrangement genau eines, Begruendung am Dienst).
router.post(
  '/songs/:songId/arrangements/:arrangementId/songselect/chordpro',
  asyncHandler(postSongSelectChordPro),
);

export default router;
