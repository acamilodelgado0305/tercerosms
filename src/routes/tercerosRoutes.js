import express from "express";
import {
    getAllTerceros,
    getTerceroById,
} from "../controllers/tercerosController.js"; // Adjust path if needed

const router = express.Router();

// 1. Get all terceros
router.get("/terceros", getAllTerceros);

// 2. Get a single tercero by ID
router.get("/terceros/:id", getTerceroById);

export default router;