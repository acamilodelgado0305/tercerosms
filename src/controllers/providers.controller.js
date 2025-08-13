import { v4 as uuidv4 } from 'uuid';
import pool from '../database.js';





export const getProveedoresYRRHH = async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // 1. CONSULTA ÚNICA Y OPTIMIZADA
        // Se eliminan los LEFT JOINs porque todos los campos requeridos están en la tabla 'terceros'.
        // Se eliminan LIMIT y OFFSET para quitar la paginación.
        const dataQuery = `
            SELECT
                id,
                nombre,
                tipo,
                tipo_identificacion,
                numero_identificacion
            FROM public.terceros
            WHERE tipo IN ('proveedor', 'rrhh')
            ORDER BY nombre ASC;
        `;

        const dataResult = await client.query(dataQuery);
        
        // 2. FORMATEO SIMPLE DE LA RESPUESTA
        // Ya no es necesario el mapeo complejo. La data de la BD tiene la forma que necesitamos.
        const datosFormateados = dataResult.rows.map(row => ({
            id: row.id,
            nombre: row.nombre,
            tipo: row.tipo,
            identificacion: {
                tipo: row.tipo_identificacion,
                numero: row.numero_identificacion
            }
        }));

        // 3. ENVIAR RESPUESTA FINAL SIN PAGINACIÓN
        res.status(200).json({
            message: 'Lista simplificada de Proveedores y RRHH obtenida exitosamente.',
            totalItems: dataResult.rowCount, // Es útil saber cuántos registros se trajeron.
            data: datosFormateados,
        });

    } catch (error) {
        console.error('Error en getProveedoresYRRHH_Simplificado:', error);
        res.status(500).json({
            error: 'Ocurrió un error inesperado al obtener la lista simplificada de terceros.',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};
