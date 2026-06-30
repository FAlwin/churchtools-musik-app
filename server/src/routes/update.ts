import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getUpdateInfoCtrl } from '../controllers/updateController.js';

const router = Router();

// Öffentlich: die App fragt ohne Anmeldung nach der neuesten Version.
router.get('/update-check', asyncHandler(getUpdateInfoCtrl));

export default router;
