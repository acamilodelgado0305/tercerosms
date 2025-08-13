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
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            nombre, tipo, tipo_identificacion, numero_identificacion,
            direccion, ciudad, departamento, pais,
            telefono, correo,
            ...specificData
        } = req.body;

        if (!nombre || !tipo) {
            return res.status(400).json({ error: 'El nombre y el tipo del tercero son obligatorios.' });
        }

        const idTercero = uuidv4();

        // 1. Inserción en 'terceros'
        const queryTercero = `
            INSERT INTO public.terceros (id, nombre, tipo, tipo_identificacion, numero_identificacion, direccion, ciudad, departamento, pais, telefono, correo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;
        `;
        
        // CORRECCIÓN: Se eliminó JSON.stringify. Pasamos los objetos directamente.
        const valuesTercero = [
            idTercero, nombre, tipo,
            tipo_identificacion || null, numero_identificacion || null,
            direccion || null, ciudad || null, departamento || null, pais || null,
            telefono || {}, correo || {}
        ];

        const { rows: [newTercero] } = await client.query(queryTercero, valuesTercero);

        // 2. Inserción en tablas de detalles
        let details = {};
        if (tipo === 'cajero') {
            const { responsable, comision_porcentaje, activo = true, observaciones, nombre_cajero, importe_personalizado = false } = specificData;
            const queryCajero = `
                INSERT INTO public.cajeros (id_cajero, responsable, comision_porcentaje, activo, observaciones, nombre, importe_personalizado)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
            `;
            const valuesCajero = [idTercero, responsable || nombre, comision_porcentaje || 0, activo, observaciones, nombre_cajero || nombre, importe_personalizado];
            const { rows: [result] } = await client.query(queryCajero, valuesCajero);
            details = result;
        } else if (tipo === 'proveedor') {
            const { otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal } = specificData;
            const queryProveedor = `
                INSERT INTO public.proveedores (id, otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
            `;
            // CORRECCIÓN: Se eliminó JSON.stringify.
            const valuesProveedor = [idTercero, otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal || []];
            const { rows: [result] } = await client.query(queryProveedor, valuesProveedor);
            details = result;
        } else if (tipo === 'rrhh') {
            const { rut, certificado_bancario, medio_pago, cargo } = specificData;
            const queryRrhh = `
                INSERT INTO public.rrhh (id, rut, certificado_bancario, medio_pago, cargo)
                VALUES ($1, $2, $3, $4, $5) RETURNING *;
            `;
            const valuesRrhh = [idTercero, rut, certificado_bancario, medio_pago, cargo];
            const { rows: [result] } = await client.query(queryRrhh, valuesRrhh);
            details = result;
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: `Tercero de tipo '${tipo}' creado exitosamente.`,
            data: { ...newTercero, ...details } // Enviamos una respuesta plana y combinada
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en createTercero:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear el tercero.', details: error.message });
    } finally {
        if (client) client.release();
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
    const client = await pool.connect();

    try {
        // Tu consulta es eficiente, la mantenemos. Trae todos los datos de una vez.
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

        if (!fullData) {
            return res.status(404).json({ error: 'Tercero no encontrado' });
        }

        // CORRECCIÓN: Procesamos 'fullData' para enviarlo como un solo objeto plano.
        // El frontend ya no necesitará separar 'tercero' de 'details'.
        
        // Renombramos los campos que tienen el mismo nombre en diferentes tablas (ej. 'rut')
        // para que no se sobreescriban en el objeto final.
        if (fullData.tipo === 'proveedor') {
            fullData.rut = fullData.proveedor_rut;
            fullData.certificado_bancario = fullData.proveedor_cb;
            fullData.medio_pago = fullData.proveedor_mp;
        } else if (fullData.tipo === 'rrhh') {
            fullData.rut = fullData.rrhh_rut;
            fullData.certificado_bancario = fullData.rrhh_cb;
            fullData.medio_pago = fullData.rrhh_mp;
        }

        res.status(200).json({
            message: 'Tercero obtenido exitosamente',
            data: fullData, // Enviamos el objeto plano directamente.
        });

    } catch (error) {
        console.error('Error in getTerceroById:', error);
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    } finally {
        if (client) client.release();
    }
};


// Función auxiliar para construir consultas de actualización dinámicas de forma segura
// En algún archivo de utilidades o al inicio de tu controlador
const TERCERO_COLUMNS = ['nombre', 'tipo', 'tipo_identificacion', 'numero_identificacion', 'direccion', 'ciudad', 'telefono', 'correo', 'pais', 'departamento'];
const CAJERO_COLUMNS = ['nombre', 'responsable', 'comision_porcentaje', 'activo', 'observaciones', 'importe_personalizado'];
const PROVEEDOR_COLUMNS = ['otros_documentos', 'sitioweb', 'camara_comercio', 'rut', 'certificado_bancario', 'medio_pago', 'responsable_iva', 'responsabilidad_fiscal'];
const RRHH_COLUMNS = ['rut', 'certificado_bancario', 'medio_pago', 'cargo'];

// Función auxiliar para construir el objeto de datos para una tabla específica
const extractFieldsForTable = (body, columns) => {
    const data = {};
    for (const col of columns) {
        if (body[col] !== undefined) {
            data[col] = body[col];
        }
    }
    return data;
};

const getTerceroTypeDetails = (type) => {
    switch (type) {
        case 'cajero': return { tableName: 'cajeros', idField: 'id_cajero', columns: CAJERO_COLUMNS };
        case 'proveedor': return { tableName: 'proveedores', idField: 'id', columns: PROVEEDOR_COLUMNS };
        case 'rrhh': return { tableName: 'rrhh', idField: 'id', columns: RRHH_COLUMNS };
        default: return null;
    }
};

// Función para construir la consulta de actualización
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

        // 1. OBTENER ESTADO ACTUAL DEL TERCERO
        const { rows: [currentTercero] } = await client.query('SELECT * FROM public.terceros WHERE id = $1 FOR UPDATE', [id]);
        if (!currentTercero) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Tercero no encontrado' });
        }
        
        const currentType = currentTercero.tipo;
        const newType = req.body.tipo;

        // 2. ACTUALIZAR LA TABLA PRINCIPAL 'terceros'
        // Mapeamos el nombre del cajero si viene en el payload.
        if (newType === 'cajero' && req.body.nombre_cajero) {
            req.body.nombre = req.body.nombre_cajero;
        }

        const terceroDataToUpdate = extractFieldsForTable(req.body, TERCERO_COLUMNS);
        terceroDataToUpdate.tipo = newType || currentType;

        const { query: updateTerceroQuery, values: terceroValues } = buildUpdateQuery('terceros', terceroDataToUpdate, 'id');
        await client.query(updateTerceroQuery, [...terceroValues, id]);

        // 3. LÓGICA DE MANEJO DE DETALLES (SI HAY CAMBIO DE TIPO)
        if (newType && newType !== currentType) {
            // 3A. Eliminar el registro de la tabla de detalles ANTIGUA
            const oldDetailsInfo = getTerceroTypeDetails(currentType);
            if (oldDetailsInfo) {
                await client.query(`DELETE FROM public.${oldDetailsInfo.tableName} WHERE ${oldDetailsInfo.idField} = $1`, [id]);
            }

            // 3B. Crear un nuevo registro en la tabla de detalles NUEVA
            const newDetailsInfo = getTerceroTypeDetails(newType);
            if (newDetailsInfo) {
                const dataForNewDetails = extractFieldsForTable(req.body, newDetailsInfo.columns);
                
                const finalDataForInsert = {
                    [newDetailsInfo.idField]: id,
                    ...dataForNewDetails
                };

                const columns = Object.keys(finalDataForInsert);
                const values = Object.values(finalDataForInsert);
                // Aquí creamos el string de placeholders, como "$1, $2, $3"
                const valuesPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');

                // ===== INICIO DE LA CORRECCIÓN =====
                // El error estaba aquí. Usamos la variable 'valuesPlaceholders' directamente,
                // porque ya es un string y no necesita otro .join().
                const insertQuery = `INSERT INTO public.${newDetailsInfo.tableName} (${columns.join(', ')}) VALUES (${valuesPlaceholders})`;
                // ===== FIN DE LA CORRECCIÓN =====

                await client.query(insertQuery, values);
            }
        } else {
            // 4. LÓGICA DE ACTUALIZACIÓN SIMPLE (SIN CAMBIO DE TIPO)
            const detailsInfo = getTerceroTypeDetails(currentType);
            if (detailsInfo) {
                const detailsDataToUpdate = extractFieldsForTable(req.body, detailsInfo.columns);
                if (Object.keys(detailsDataToUpdate).length > 0) {
                    const { query: updateDetailsQuery, values: detailsValues } = buildUpdateQuery(detailsInfo.tableName, detailsDataToUpdate, detailsInfo.idField);
                    await client.query(updateDetailsQuery, [...detailsValues, id]);
                }
            }
        }

        await client.query('COMMIT');

        // Volvemos a pedir los datos completos para devolver la versión más actualizada
        const updatedTerceroResponse = await getTerceroByIdForInternalUse(id, client);

        res.status(200).json({
            message: 'Tercero actualizado exitosamente',
            data: updatedTerceroResponse
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en updateTercero:', error);
        // Devolvemos el error específico para facilitar el debug en el frontend
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    } finally {
        if (client) client.release();
    }
};

// Es buena idea tener una función auxiliar para uso interno que ya tenga el cliente
async function getTerceroByIdForInternalUse(id, client) {
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
    return fullData || null;
}




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