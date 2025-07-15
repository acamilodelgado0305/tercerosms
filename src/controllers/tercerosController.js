import pool from '../database.js'; // Adjust this path to your actual DB connection pool for the 'terceros' database.
import { v4 as uuidv4 } from 'uuid'; // uuidv4 is not strictly needed for GET operations, but kept for consistency if other methods are in this file.

/**
 * @function getAllTerceros
 * @description Obtiene todos los registros de la tabla 'terceros'.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
export const getAllTerceros = async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const query = `
            SELECT 
                id,
                nombre,
                tipo
            FROM 
                public.terceros;
        `;
        const result = await client.query(query);

        res.status(200).json({
            message: 'Terceros obtenidos exitosamente',
            data: result.rows,
        });
    } catch (error) {
        console.error('Error in getAllTerceros:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

// ----------------------------------------------------------------------------------------------------

/**
 * @function getTerceroById
 * @description Obtiene un registro de la tabla 'terceros' por su ID.
 * @param {object} req - Objeto de solicitud de Express (espera 'id' en req.params).
 * @param {object} res - Objeto de respuesta de Express.
 */
export const getTerceroById = async (req, res) => {
    const { id } = req.params; // Get the ID from the URL parameters
    let client;
    try {
        client = await pool.connect();
        const query = `
            SELECT 
                id,
                nombre,
                tipo
            FROM 
                public.terceros
            WHERE 
                id = $1;
        `;
        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Tercero no encontrado',
                details: `No se encontró un tercero con el ID: ${id}`,
            });
        }

        res.status(200).json({
            message: 'Tercero obtenido exitosamente',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error in getTerceroById:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};