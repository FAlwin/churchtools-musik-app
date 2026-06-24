import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireSession } from '../middleware/session.js';
import {
  getAnnotations,
  putAnnotation,
  deleteAnnotation,
} from '../controllers/annotationsController.js';

const router = Router();

router.use(requireSession);
router.get('/annotations', asyncHandler(getAnnotations));
router.put('/annotations/:key', asyncHandler(putAnnotation));
router.delete('/annotations/:key', asyncHandler(deleteAnnotation));

export default router;
