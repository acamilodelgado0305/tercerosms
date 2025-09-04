import express from "express";
import {
  createCajero,
  getAllCajeros,
  getCajeroById,
  updateCajero,
  deleteCajero,
} from "../controllers/cajero.controller.js";
import { authMiddleware } from "../middlewares/authenticateToken.js";

const router = express.Router();

// 1. Obtener todos los cajeros
router.get("/cajeros",authMiddleware, getAllCajeros);

// 2. Crear un nuevo cajero
router.post("/cajeros", createCajero);

// 3. Obtener un cajero por ID
router.get("/cajeros/:id", getCajeroById);

// 4. Actualizar un cajero existente
router.put("/cajeros/:id", updateCajero);

// 5. Eliminar un cajero
router.delete("/cajeros/:id", deleteCajero);

export default router;