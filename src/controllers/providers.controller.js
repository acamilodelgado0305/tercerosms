import { v4 as uuidv4 } from 'uuid';
import pool from '../database.js';


export const getProveedoresYRRHH = async (req, res) => {
    // NUEVO: Obtenemos el workspaceId desde el token del usuario.
    const { workspaceId } = req.user;

    let client;
    try {
        client = await pool.connect();

        // CAMBIO: Se añade el filtro por workspace_id a la cláusula WHERE.
        const dataQuery = `
            SELECT
                id,
                nombre,
                tipo,
                tipo_identificacion,
                numero_identificacion
            FROM public.terceros
            WHERE 
                workspace_id = $1 AND tipo IN ('proveedor', 'rrhh')
            ORDER BY nombre ASC;
        `;

        // Se pasa el workspaceId como parámetro a la consulta.
        const dataResult = await client.query(dataQuery, [workspaceId]);
        
        // La lógica de formateo se mantiene, es correcta.
        const datosFormateados = dataResult.rows.map(row => ({
            id: row.id,
            nombre: row.nombre,
            tipo: row.tipo,
            identificacion: {
                tipo: row.tipo_identificacion,
                numero: row.numero_identificacion
            }
        }));

        res.status(200).json({
            message: 'Lista simplificada de Proveedores y RRHH obtenida exitosamente.',
            totalItems: dataResult.rowCount,
            data: datosFormateados,
        });

    } catch (error) {
        console.error('Error en getProveedoresYRRHH:', error); // Nombre de función corregido en el log
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