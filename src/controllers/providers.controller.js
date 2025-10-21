import { v4 as uuidv4 } from 'uuid';
import pool from '../database.js'; // Asegúrate que la ruta sea correcta

export const getProveedoresYRRHH = async (req, res) => {
    // 1. Obtenemos el workspaceId (tu lógica es correcta)
    const { workspaceId } = req.user;
    let client;

    try {
        client = await pool.connect();

        // --- INICIO DE LA CORRECCIÓN: Consulta SQL con Subquery ---
        const dataQuery = `
            SELECT
                t.id,
                t.nombre,
                t.tipo,
                t.tipo_identificacion,
                t.numero_identificacion,
                -- 3. Usamos COALESCE para convertir el NULL (de terceros sin cuentas) en un array vacío '[]'
                COALESCE(cuentas_agg.cuentas, '[]'::jsonb) as cuentas
            
            FROM public.terceros t
            
            -- 2. Hacemos LEFT JOIN a nuestra subconsulta que ya tiene las cuentas agregadas
            LEFT JOIN (
                SELECT
                    c.tercero_id,
                    jsonb_agg(
                        -- Aquí construimos el objeto JSON para CADA cuenta
                        jsonb_build_object(
                            'id', c.id,
                            'nombre_banco', c.nombre_banco,
                            'numero_cuenta', c.numero_cuenta,
                            'tipo_cuenta', c.tipo_cuenta,
                            'es_preferida', c.es_preferida
                        )
                        -- Ordenamos las cuentas DENTRO del array JSON (opcional pero recomendado)
                        ORDER BY c.es_preferida DESC, c.fecha_creacion ASC
                    ) as cuentas
                FROM public.cuentas_bancarias_terceros c
                -- Agrupamos solo la subconsulta de cuentas
                GROUP BY c.tercero_id
            ) as cuentas_agg ON t.id = cuentas_agg.tercero_id
            
            -- 1. Filtramos la tabla principal de terceros (tu lógica original)
            WHERE 
                t.workspace_id = $1 AND t.tipo IN ('proveedor', 'rrhh')
                
            ORDER BY t.nombre ASC;
        `;
        // --- FIN DE LA CORRECCIÓN ---

        const dataResult = await client.query(dataQuery, [workspaceId]);
        
        // La lógica de formateo ahora incluye las cuentas
        const datosFormateados = dataResult.rows.map(row => ({
            id: row.id,
            nombre: row.nombre,
            tipo: row.tipo,
            identificacion: {
                tipo: row.tipo_identificacion,
                numero: row.numero_identificacion
            },
            cuentas: row.cuentas // <-- ¡Aquí está el nuevo array de cuentas!
        }));

        res.status(200).json({
            message: 'Lista simplificada de Proveedores y RRHH obtenida exitosamente.',
            totalItems: dataResult.rowCount,
            data: datosFormateados,
        });

    } catch (error) {
        console.error('Error en getProveedoresYRRHH:', error); 
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