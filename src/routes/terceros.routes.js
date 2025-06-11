import express from 'express';
import {
    getAllTerceros,
    getTerceroById,
    createTercero,
    updateTercero,
    deleteTercero
} from '../controllers/terceros.controller.js'; // Nota el '.js' al final del path

const router = express.Router();

// Rutas CRUD para la entidad 'Terceros'

// GET /api/v1/terceros
// Obtiene todos los terceros. Permite filtrar por tipo_tercero (ej: /api/v1/terceros?tipo_tercero=rrhh)
router.get('/', getAllTerceros);

// GET /api/v1/terceros/:id
// Obtiene un tercero específico por su ID
router.get('/:id', getTerceroById);

// POST /api/v1/terceros
// Crea un nuevo tercero. El cuerpo de la petición debe contener los datos del tercero.
router.post('/', createTercero);

// PUT /api/v1/terceros/:id
// Actualiza un tercero existente por su ID. El cuerpo de la petición debe contener los datos actualizados.
router.put('/:id', updateTercero);

// DELETE /api/v1/terceros/:id
// Elimina un tercero por su ID.
router.delete('/:id', deleteTercero);

export default router;