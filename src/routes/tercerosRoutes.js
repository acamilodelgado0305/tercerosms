import express from "express";
import {
    createTercero,
    getAllTerceros,
    getTerceroById,
    updateTercero,
    deleteTercero,
    getTercerosSummary,
    getTerceros,
    searchTerceros
} from "../controllers/tercerosController.js";
import { authMiddleware } from "../middlewares/authenticateToken.js";

const router = express.Router();

// =============================================================================
// 🚨 ZONA DE RUTAS ESTÁTICAS (Deben ir PRIMERO)
// Si pones estas después de /terceros/:id, Express pensará que "search" o "summary" son IDs.
// =============================================================================

// 1. Resumen
router.get("/terceros/summary", authMiddleware, getTercerosSummary);

// 2. Búsqueda (CORREGIDO: Se agregó el '/' al inicio)
router.get("/terceros/search", authMiddleware, searchTerceros);

// 3. Listado General
router.get("/terceros", authMiddleware, getAllTerceros);
router.get("/allterceros", getTerceros); // Ruta auxiliar si la usas


// =============================================================================
// 🚨 ZONA DE RUTAS DINÁMICAS (Deben ir AL FINAL)
// Aquí capturamos los IDs. Cualquier cosa que no coincida arriba, caerá aquí.
// =============================================================================

// 4. Obtener por ID
// Unificamos las rutas get. Asegúrate de usar authMiddleware si es privado.
router.get("/terceros/:id", getTerceroById);
// router.get("/tercero/:id", getTerceroById); // ⚠️ Recomendación: Evita duplicar rutas con nombres singulares/plurales para no confundir.

// 5. Crear
router.post("/terceros", authMiddleware, createTercero);

// 6. Actualizar
router.put("/terceros/:id", authMiddleware, updateTercero);
router.patch("/terceros/:id", authMiddleware, updateTercero);

// 7. Eliminar
router.delete("/terceros/:id", authMiddleware, deleteTercero);

export default router;