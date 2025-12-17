import { v4 as uuidv4 } from 'uuid';
import pool from '../database.js'; // Asegúrate que la ruta sea correcta

// Renombramos la función para reflejar que trae TODO el universo de terceros
export const getAllTerceros = async (req, res) => {
    const { workspaceId } = req.user;
    let client;

    try {
        client = await pool.connect();

        const dataQuery = `
            SELECT
                t.id,
                t.nombre,
                t.tipo,               -- Nota: Importante para filtrar en el Frontend si es necesario
                t.tipo_identificacion,
                t.numero_identificacion,
                t.telefono,           -- Sugerencia: suele ser útil en listados generales
                t.correo,              -- Sugerencia: suele ser útil en listados generales
                -- COALESCE asegura que el frontend siempre reciba un array, nunca null
                COALESCE(cuentas_agg.cuentas, '[]'::jsonb) as cuentas
            
            FROM public.terceros t
            
            -- Subconsulta optimizada para agregar cuentas bancarias (relación 1:N)
            LEFT JOIN (
                SELECT
                    c.tercero_id,
                    jsonb_agg(
                        jsonb_build_object(
                            'id', c.id,
                            'nombre_banco', c.nombre_banco,
                            'numero_cuenta', c.numero_cuenta,
                            'tipo_cuenta', c.tipo_cuenta,
                            'es_preferida', c.es_preferida
                        )
                        ORDER BY c.es_preferida DESC, c.fecha_creacion ASC
                    ) as cuentas
                FROM public.cuentas_bancarias_terceros c
                GROUP BY c.tercero_id
            ) as cuentas_agg ON t.id = cuentas_agg.tercero_id
            
            -- CAMBIO CRÍTICO: Eliminamos el filtro "AND t.tipo IN (...)"
            -- Ahora solo filtramos por el entorno de trabajo (Multitenancy)
            WHERE t.workspace_id = $1 
                
            ORDER BY t.nombre ASC;
        `;

        const dataResult = await client.query(dataQuery, [workspaceId]);
        
        // Mapeo de respuesta
        const datosFormateados = dataResult.rows.map(row => ({
            id: row.id,
            nombre: row.nombre,
            tipo: row.tipo, // 'cliente', 'proveedor', 'rrhh', 'otros'
            identificacion: {
                tipo: row.tipo_identificacion,
                numero: row.numero_identificacion
            },
            contacto: { // Agrupamos datos de contacto para limpieza
                email: row.email || null,
                telefono: row.telefono || null
            },
            cuentas: row.cuentas
        }));

        res.status(200).json({
            message: 'Directorio global de terceros obtenido exitosamente.',
            totalItems: dataResult.rowCount,
            data: datosFormateados,
        });

    } catch (error) {
        console.error('Error en getAllTerceros:', error); 
        res.status(500).json({
            error: 'Error crítico al consultar el directorio de terceros.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};