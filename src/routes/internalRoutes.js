// En el microservicio Finanzas: /routes/internalRoutes.js
import express from 'express';
import { deleteWorkspaceData } from '../controllers/internalController.js';
import { verifyInternalApiKey } from '../middlewares/authenticateToken.js';

const router = express.Router();

// Este endpoint será llamado por el Orquestador
router.delete('/workspace-data/:workspaceId', verifyInternalApiKey, deleteWorkspaceData);

export default router;