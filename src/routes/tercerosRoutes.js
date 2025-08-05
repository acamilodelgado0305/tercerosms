// src/routes/tercerosRoutes.js (or whatever you've named your router file)

import express from "express";
import {
    createTercero, // Import the new create function
    getAllTerceros,
    getTerceroById,
    updateTercero, // Import the new update function
    deleteTercero,
    getTercerosSummary // Import the new delete function
} from "../controllers/tercerosController.js"; // *** Crucial: Ensure '.js' extension here ***

const router = express.Router();

// 1. Get all terceros

// Ruta correcta
router.get("/terceros/summary", getTercerosSummary); 

router.get("/terceros", getAllTerceros);

// 2. Get a single tercero by ID


// 3. Create a new tercero
router.post("/terceros", createTercero);



// 4. Update a tercero by ID
router.put("/terceros/:id", updateTercero);
router.patch("/terceros/:id", updateTercero); // Use PATCH for partial updates

// 5. Delete a tercero by ID
router.delete("/terceros/:id", deleteTercero);

router.get("/terceros/:id", getTerceroById);
router.get("/tercero/:id", getTerceroById);

export default router;