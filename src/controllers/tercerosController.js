import pool from '../database.js'; // Adjust this path to your actual DB connection pool.
import { v4 as uuidv4 } from 'uuid'; // Import uuid for generating unique IDs


const fetchFullTerceroById = async (id, client) => {
    const query = `
        SELECT
            t.*,
            c.responsable, c.comision_porcentaje, c.activo, c.observaciones, c.nombre as nombre_cajero, c.importe_personalizado,
            p.otros_documentos, p.sitioweb, p.camara_comercio, p.rut as proveedor_rut, p.certificado_bancario as proveedor_cb, p.medio_pago as proveedor_mp, p.responsable_iva, p.responsabilidad_fiscal,
            h.cargo, h.rut as rrhh_rut, h.certificado_bancario as rrhh_cb, h.medio_pago as rrhh_mp
        FROM public.terceros t
        LEFT JOIN public.cajeros c ON t.id = c.id_cajero
        LEFT JOIN public.proveedores p ON t.id = p.id
        LEFT JOIN public.rrhh h ON t.id = h.id
        WHERE t.id = $1;
    `;
    const { rows: [fullData] } = await client.query(query, [id]);

    if (!fullData) return null;

    // Estructuramos la respuesta para que sea siempre consistente
    const tercero = {
        id: fullData.id,
        nombre: fullData.nombre,
        tipo: fullData.tipo,
        tipo_identificacion: fullData.tipo_identificacion,
        numero_identificacion: fullData.numero_identificacion,
        direccion: fullData.direccion,
        ciudad: fullData.ciudad,
        departamento: fullData.departamento,
        pais: fullData.pais,
        telefono: fullData.telefono,
        correo: fullData.correo,
        fecha_creacion: fullData.fecha_creacion,
        fecha_actualizacion: fullData.fecha_actualizacion,
    };

    let details = {};
    if (tercero.tipo === 'cajero') {
        details = { /* ... Lógica para construir details de cajero ... */ };
    } else if (tercero.tipo === 'proveedor') {
        details = { /* ... Lógica para construir details de proveedor ... */ };
    } else if (tercero.tipo === 'rrhh') {
        details = { /* ... Lógica para construir details de rrhh ... */ };
    }

    return { tercero, details };
};



export const createTercero = async (req, res) => {
    // 1. Iniciar conexión y transacción
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Desestructurar datos de la petición
        const {
            nombre, tipo, tipo_identificacion, numero_identificacion,
            direccion, ciudad, departamento, pais,
            telefono, correo,
            ...specificData
        } = req.body;

        // 3. Validación
        if (!nombre || !tipo) {
            return res.status(400).json({ error: 'El nombre del tercero y el tipo (cajero, proveedor, rrhh) son obligatorios.' });
        }

        const idTercero = uuidv4();

        // 4. Inserción en 'terceros'
        const queryTercero = `
            INSERT INTO public.terceros (
                id, nombre, tipo, tipo_identificacion, numero_identificacion,
                direccion, ciudad, departamento, pais, telefono, correo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *;
        `;

        const valuesTercero = [
            idTercero, nombre, tipo,
            tipo_identificacion || null, numero_identificacion || null,
            direccion || null, ciudad || null, departamento || null, pais || null,
            JSON.stringify(telefono || {}), JSON.stringify(correo || {})
        ];

        const resultTercero = await client.query(queryTercero, valuesTercero);
        const newTercero = resultTercero.rows[0];

        // 5. Lógica condicional para insertar en la tabla de rol específica
        let relatedData = null;

        if (tipo === 'cajero') {
            const { responsable, comision_porcentaje, activo = true, observaciones, nombre: nombre_cajero, importe_personalizado = false } = specificData;
            const queryCajero = `
                INSERT INTO public.cajeros (id_cajero, responsable, comision_porcentaje, activo, observaciones, nombre, importe_personalizado)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
            `; //
            const valuesCajero = [idTercero, responsable || nombre, comision_porcentaje || 0, activo, observaciones, nombre_cajero || nombre, importe_personalizado];
            const resultCajero = await client.query(queryCajero, valuesCajero);
            relatedData = resultCajero.rows[0];

        } else if (tipo === 'proveedor') {
            const { otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal } = specificData;
            const queryProveedor = `
                INSERT INTO public.proveedores (id, otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
            `; //
            const valuesProveedor = [idTercero, otros_documentos || null, sitioweb || null, camara_comercio || null, rut || null, certificado_bancario || null, medio_pago || null, responsable_iva || null, JSON.stringify(responsabilidad_fiscal || [])];
            const resultProveedor = await client.query(queryProveedor, valuesProveedor);
            relatedData = resultProveedor.rows[0];

        } else if (tipo === 'rrhh') {
            const { rut, certificado_bancario, medio_pago, cargo } = specificData;
            const queryRrhh = `
                INSERT INTO public.rrhh (id, rut, certificado_bancario, medio_pago, cargo)
                VALUES ($1, $2, $3, $4, $5) RETURNING *;
            `; //
            const valuesRrhh = [idTercero, rut || null, certificado_bancario || null, medio_pago || null, cargo || null];
            const resultRrhh = await client.query(queryRrhh, valuesRrhh);
            relatedData = resultRrhh.rows[0];
        }

        // 6. Confirmar la transacción
        await client.query('COMMIT');

        res.status(201).json({
            message: `Tercero de tipo '${tipo}' creado exitosamente.`,
            data: {
                tercero: newTercero,
                details: relatedData
            },
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en createTercero:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear el tercero.', details: error.message });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const getAllTerceros = async (req, res) => {
    // 1. OBTENER Y SANETIZAR PARÁMETROS DE CONSULTA
    const { search = '' } = req.query;

    // FIX 1: Parsear y validar page y limit para asegurar que sean números.
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    // La lógica de filtrado de tipo está bien, la mantenemos.
    let tipo = req.query.tipo || 'proveedor';
    if (tipo === 'resumen') {
        tipo = 'proveedor';
    } else if (tipo === 'todos') {
        tipo = '';
    }

    // FIX 2: Ampliar la lista de campos permitidos para ordenar.
    const allowedSortBy = ['id', 'nombre', 'tipo', 'numero_identificacion', 'ciudad', 'departamento', 'pais', 'fecha_creacion'];
    const sortBy = allowedSortBy.includes(req.query.sortBy) ? req.query.sortBy : 'nombre';
    const sortOrder = ['ASC', 'DESC'].includes(req.query.sortOrder?.toUpperCase()) ? req.query.sortOrder.toUpperCase() : 'ASC';

    let client;
    try {
        client = await pool.connect();

        const queryParams = [];
        let whereClauses = [];

        if (search) {
            queryParams.push(`%${search}%`);
            // FIX 3: Hacer la búsqueda robusta ante nulos con COALESCE.
            whereClauses.push(`(COALESCE(nombre, '') || ' ' || COALESCE(numero_identificacion, '')) ILIKE $${queryParams.length}`);
        }

        if (tipo) {
            queryParams.push(tipo);
            whereClauses.push(`tipo = $${queryParams.length}`);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // 2. OBTENER EL CONTEO TOTAL DE ELEMENTOS
        const totalQuery = `SELECT COUNT(*) FROM public.terceros ${whereString}`;
        const totalResult = await client.query(totalQuery, queryParams);
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        // 3. OBTENER LOS DATOS PAGINADOS
        const offset = (page - 1) * limit;
        const dataQueryParams = [...queryParams, limit, offset];

        const dataQuery = `
            SELECT
                -- FIX 4: Incluir TODAS las columnas de la tabla terceros.
                id, nombre, tipo, tipo_identificacion, numero_identificacion,
                direccion, ciudad, departamento, pais, telefono, correo,
                fecha_creacion, fecha_actualizacion
            FROM
                public.terceros
            ${whereString}
            ORDER BY "${sortBy}" ${sortOrder}
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
        `;

        const dataResult = await client.query(dataQuery, dataQueryParams);

        // 4. ENVIAR RESPUESTA
        res.status(200).json({
            message: 'Terceros obtenidos exitosamente',
            data: dataResult.rows,
            pagination: {
                currentPage: page,
                pageSize: limit,
                totalItems,
                totalPages,
            },
        });

    } catch (error) {
        console.error('Error in getAllTerceros:', error);
        res.status(500).json({ error: 'Ocurrió un error inesperado al obtener los terceros.', details: error.message });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const getTerceros = async (req, res) => {
    let client;
    try {
        // 1. Conectar al pool de la base de datos.
        client = await pool.connect();

        // 2. Query simple y directa: Selecciona todas las columnas (*) de la tabla.
        // Se añade un ORDER BY para mantener un orden predecible, lo cual es una buena práctica incluso en volcados de datos.
        const dataQuery = `
            SELECT 
                id, nombre, tipo, tipo_identificacion, numero_identificacion
            FROM 
                public.terceros
            ORDER BY 
                nombre ASC;
        `;

        const dataResult = await client.query(dataQuery);

        // 3. Enviar una respuesta directa con todos los datos.
        // No hay objeto de paginación porque no aplica.
        res.status(200).json({
            message: 'Todos los terceros han sido obtenidos exitosamente (sin paginación).',
            totalItems: dataResult.rowCount, // Es útil saber cuántos registros se trajeron.
            data: dataResult.rows,
        });

    } catch (error) {
        // El manejo de errores se mantiene robusto.
        console.error('Error in getAllTercerosParaPrueba:', error);
        res.status(500).json({ 
            error: 'Ocurrió un error inesperado al obtener los terceros.', 
            details: error.message 
        });
    } finally {
        // La liberación del cliente es crucial y se mantiene.
        if (client) {
            client.release();
        }
    }
};

export const getAllCajeros = async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const offset = (page - 1) * limit;

    let client;
    try {
        client = await pool.connect();

        const totalQuery = `
            SELECT COUNT(*)
            FROM public.terceros t
            INNER JOIN public.cajeros c ON t.id = c.id_cajero
            WHERE t.tipo = 'cajero';
        `;
        const totalResult = await client.query(totalQuery);
        const totalItems = parseInt(totalResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        // ===== CONSULTA CORREGIDA =====
       
        // 'ciudad', 'departamento' y 'pais' se obtienen de 't' (terceros).
        const dataQuery = `
            SELECT
                t.id,
                t.nombre,
                t.direccion,
                t.ciudad,
                t.departamento,
                t.pais,
                t.telefono,
                t.correo,
                c.responsable AS responsable_cajero,
                c.comision_porcentaje,
                c.activo,
                c.observaciones,
                c.importe_personalizado,
                c.nombre AS nombre_asignado_cajero
            FROM
                public.terceros t
            INNER JOIN
                public.cajeros c ON t.id = c.id_cajero
            WHERE
                t.tipo = 'cajero'
            ORDER BY
                t.nombre ASC
            LIMIT $1 OFFSET $2;
        `;

        const dataResult = await client.query(dataQuery, [limit, offset]);

        res.status(200).json({
            message: 'Cajeros obtenidos exitosamente.',
            data: dataResult.rows,
            pagination: {
                currentPage: page,
                pageSize: limit,
                totalItems,
                totalPages,
            },
        });

    } catch (error) {
        console.error('Error en getAllCajeros:', error);
        res.status(500).json({
            error: 'Ocurrió un error inesperado al obtener los cajeros.',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const getTerceroById = async (req, res) => {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        const fullTerceroData = await fetchFullTerceroById(id, client);

        if (!fullTerceroData) {
            return res.status(404).json({ error: 'Tercero no encontrado' });
        }

        res.status(200).json({
            message: 'Tercero obtenido exitosamente',
            data: fullTerceroData,
        });
    } catch (error) {
        console.error('Error in getTerceroById:', error);
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    } finally {
        if (client) client.release();
    }
};


// Función auxiliar para construir consultas de actualización dinámicas de forma segura
const buildUpdateQuery = (table, fields, idField = 'id') => {
    const setClause = Object.keys(fields).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
    const values = Object.values(fields);
    const query = `UPDATE public.${table} SET ${setClause} WHERE "${idField}" = $${values.length + 1} RETURNING *;`;
    return { query, values };
};

export const updateTercero = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: [currentTercero] } = await client.query('SELECT tipo FROM public.terceros WHERE id = $1', [id]);
        if (!currentTercero) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Tercero no encontrado' });
        }
        const currentType = currentTercero.tipo;

        const terceroFields = {};
        const specificFields = {};
        const terceroColumns = ['nombre', 'tipo_identificacion', 'numero_identificacion', 'direccion', 'ciudad', 'departamento', 'pais', 'telefono', 'correo'];

        for (const key in req.body) {
            if (terceroColumns.includes(key)) {
                terceroFields[key] = req.body[key];
            } else if (key !== 'tipo') { // Ignoramos 'tipo' para la actualización simple
                specificFields[key] = req.body[key];
            }
        }
        
        if (terceroFields.telefono) terceroFields.telefono = JSON.stringify(terceroFields.telefono || {});
        if (terceroFields.correo) terceroFields.correo = JSON.stringify(terceroFields.correo || {});

        // 1. Actualizar la tabla 'terceros' si hay campos para ello
        if (Object.keys(terceroFields).length > 0) {
            const { query, values } = buildUpdateQuery('terceros', terceroFields);
            await client.query(query, [...values, id]);
        }

        // 2. Actualizar la tabla de rol específica si hay campos para ello
        if (Object.keys(specificFields).length > 0) {
            let tableName, idField;
            switch (currentType) {
                case 'cajero': tableName = 'cajeros'; idField = 'id_cajero'; break;
                case 'proveedor': tableName = 'proveedores'; idField = 'id'; break;
                case 'rrhh': tableName = 'rrhh'; idField = 'id'; break;
                default: throw new Error(`Tipo desconocido para actualizar: ${currentType}`);
            }
            const { query, values } = buildUpdateQuery(tableName, specificFields, idField);
            await client.query(query, [...values, id]);
        }

        // 3. Obtener y devolver el estado final del tercero completo
        const finalTerceroData = await fetchFullTerceroById(id, client);

        await client.query('COMMIT');
        
        res.status(200).json({
            message: 'Tercero actualizado exitosamente',
            data: finalTerceroData
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en updateTercero:', error);
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    } finally {
        if (client) client.release();
    }
};

export const deleteTercero = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Obtener el tipo de tercero. No hay cambios aquí.
        const { rows: [tercero] } = await client.query('SELECT tipo FROM public.terceros WHERE id = $1', [id]);

        if (!tercero) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Tercero no encontrado' });
        }
        const tipoTercero = tercero.tipo;

        // --- INICIO DE LA REFACTORIZACIÓN ---

        // 2. Manejar casos especiales y determinar la tabla de rol
        let tableNameToDelete;
        let idFieldToDelete;

        switch (tipoTercero) {
            case 'cajero':
                // Manejo del caso especial: eliminar registros dependientes de 'cajero'
                await client.query('DELETE FROM public.importes_personalizados WHERE id_cajero = $1', [id]);
                tableNameToDelete = 'cajeros';
                idFieldToDelete = 'id_cajero';
                break;
            case 'proveedor':
                tableNameToDelete = 'proveedores';
                idFieldToDelete = 'id';
                break;
            case 'rrhh':
                tableNameToDelete = 'rrhh';
                idFieldToDelete = 'id';
                break;
            default:
                // Si el tipo no es conocido, no podemos continuar de forma segura.
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Tipo de tercero '${tipoTercero}' no es válido para eliminación.` });
        }

        // 3. Eliminar de la tabla de rol específica (lógica unificada)
        if (tableNameToDelete) {
            const deleteRoleQuery = `DELETE FROM public.${tableNameToDelete} WHERE "${idFieldToDelete}" = $1`;
            const deleteRoleResult = await client.query(deleteRoleQuery, [id]);

            // Tu excelente verificación de integridad se mantiene
            if (deleteRoleResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(500).json({
                    error: 'Error de integridad de datos',
                    details: `El tercero ${id} es de tipo '${tipoTercero}' pero no se encontró un registro en la tabla '${tableNameToDelete}'.`,
                });
            }
        }
        // --- FIN DE LA REFACTORIZACIÓN ---

        // 4. Finalmente, eliminar el tercero de la tabla maestra. No hay cambios aquí.
        const resultTercero = await client.query('DELETE FROM public.terceros WHERE id = $1', [id]);

        if (resultTercero.rowCount === 0) {
            // Este caso es muy raro pero es bueno manejarlo
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'El tercero no pudo ser eliminado de la tabla principal.' });
        }

        await client.query('COMMIT');
        
        res.status(200).json({
            message: `Tercero de tipo '${tipoTercero}' eliminado correctamente.`,
            deletedId: id,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en deleteTercero:', error);
        res.status(500).json({
            error: 'Error interno del servidor al eliminar el tercero',
            details: error.message,
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};



export const getTercerosSummary = async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // 1. DEFINIR TODAS LAS CONSULTAS EN PARALELO
        const conteoPorTipoQuery = client.query(`
            SELECT COALESCE(tipo, 'Sin Asignar') as tipo, COUNT(*) as cantidad
            FROM public.terceros GROUP BY 1 ORDER BY cantidad DESC;
        `);

        const conteoPorCiudadQuery = client.query(`
            SELECT COALESCE(ciudad, 'Sin Ciudad') as ciudad, COUNT(*) as cantidad 
            FROM public.terceros 
            GROUP BY ciudad ORDER BY cantidad DESC LIMIT 5;
        `);

        // FIX 1: Corregir la consulta de calidad de datos para objetos JSONB
        const calidadDatosQuery = client.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE correo IS NULL OR correo = '{}'::jsonb) AS sin_correo,
                COUNT(*) FILTER (WHERE telefono IS NULL OR telefono = '{}'::jsonb) AS sin_telefono
            FROM public.terceros;
        `);

        // MEJORA 1: Añadir consulta para obtener los últimos 5 terceros creados
        const tercerosRecientesQuery = client.query(`
            SELECT id, nombre, tipo, fecha_creacion 
            FROM public.terceros 
            ORDER BY fecha_creacion DESC 
            LIMIT 5;
        `);

        // 2. EJECUTAR TODAS LAS CONSULTAS SIMULTÁNEAMENTE
        const [
            conteoPorTipoResult,
            conteoPorCiudadResult,
            calidadDatosResult,
            tercerosRecientesResult // Capturamos el nuevo resultado
        ] = await Promise.all([
            conteoPorTipoQuery,
            conteoPorCiudadQuery,
            calidadDatosQuery,
            tercerosRecientesQuery // Añadimos la nueva promesa
        ]);

        // 3. PROCESAR Y FORMATEAR LOS RESULTADOS
        const calidadDatos = calidadDatosResult.rows[0];

        // FIX 2: Usar el total ya calculado por la consulta de calidad de datos
        const totalTerceros = parseInt(calidadDatos.total, 10);

        const formattedCalidadDatos = {
            total: totalTerceros,
            sin_correo: parseInt(calidadDatos.sin_correo, 10),
            sin_telefono: parseInt(calidadDatos.sin_telefono, 10),
        };

        res.status(200).json({
            message: 'Resumen de terceros obtenido exitosamente',
            data: {
                totalTerceros,
                conteoPorTipo: conteoPorTipoResult.rows.map(r => ({ ...r, cantidad: parseInt(r.cantidad) })),
                conteoPorCiudad: conteoPorCiudadResult.rows.map(r => ({ ...r, cantidad: parseInt(r.cantidad) })),
                calidadDatos: formattedCalidadDatos,
                tercerosRecientes: tercerosRecientesResult.rows, // MEJORA 2: Añadir los datos al response
            }
        });

    } catch (error) {
        console.error('Error en getTercerosSummary:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener el resumen.' });
    } finally {
        if (client) {
            client.release();
        }
    }
};