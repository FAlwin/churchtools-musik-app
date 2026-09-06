import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getAbsences,
  postAbsence,
  putAbsence,
  deleteAbsence,
  getAbsenceEvents,
} from '../controllers/absencesController.js';

/**
 * Verfügbarkeit (#177): eigene Abwesenheiten mit dem eigenen ChurchTools-Login. Nur die Sitzung wird
 * verlangt – die Endpunkte arbeiten ausschließlich auf dem eigenen Konto, und ChurchTools
 * entscheidet über die Rechte. Der Tab in der App hängt zusätzlich an `canUseAvailability`.
 */
const router = Router();

router.use(requireSession);
// `/events` VOR `/:id` – sonst würde „events" als ID gelesen.
router.get('/absences/events', asyncHandler(getAbsenceEvents));
router.get('/absences', asyncHandler(getAbsences));
router.post('/absences', asyncHandler(postAbsence));
router.put('/absences/:id', asyncHandler(putAbsence));
router.delete('/absences/:id', asyncHandler(deleteAbsence));

export default router;
