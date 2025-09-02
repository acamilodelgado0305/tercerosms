import express from 'express';
import upload from '../../config/multerConfig.js';
import {
  getProveedoresYRRHH,
} from '../controllers/providers.controller.js';

import { manageAttachments } from '../controllers/manageAttachments.js';
import { authMiddleware } from '../middlewares/authenticateToken.js';

const router = express.Router();

// Rutas existentes
router.get('/proveedores-y-rrhh',authMiddleware, getProveedoresYRRHH);

export default router;
