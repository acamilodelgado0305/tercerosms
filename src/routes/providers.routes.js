import express from 'express';
import upload from '../../config/multerConfig.js';
import {
  getProveedoresYRRHH,
} from '../controllers/providers.controller.js';

import { manageAttachments } from '../controllers/manageAttachments.js';

const router = express.Router();

// Rutas existentes
router.get('/providers', getProveedoresYRRHH);

export default router;
