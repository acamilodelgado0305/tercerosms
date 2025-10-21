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

        const { workspaceId } = req.user;

        const {
            nombre, tipo, tipo_identificacion, numero_identificacion,
            direccion, ciudad, departamento, pais,
            telefono, correo,
            // --- NUEVO ---
            // Capturamos las cuentas. Por defecto es un array vacío.
            cuentas_bancarias = [], 
            ...specificData
        } = req.body;

        if (!nombre || !tipo || !workspaceId) {
            return res.status(400).json({ error: 'El nombre, el tipo y un workspace válido son obligatorios.' });
        }

        const idTercero = uuidv4();

        // 1. Inserción en 'terceros'
        const queryTercero = `
            INSERT INTO public.terceros (
                id, nombre, tipo, tipo_identificacion, numero_identificacion, 
                direccion, ciudad, departamento, pais, telefono, correo, workspace_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;
        `;
        
        const valuesTercero = [
            idTercero, nombre, tipo,
            tipo_identificacion || null, numero_identificacion || null,
            direccion || null, ciudad || null, departamento || null, pais || null,
            telefono || {}, correo || {},
            workspaceId
        ];

        const { rows: [newTercero] } = await client.query(queryTercero, valuesTercero);

        // 2. Inserción en tablas de detalles (Tu lógica existente)
        let details = {};
        if (tipo === 'cajero') {
            // ... tu lógica de 'cajero' ...
            const { responsable, comision_porcentaje, activo = true, observaciones, nombre_cajero, importe_personalizado = false } = specificData;
            const queryCajero = `
                INSERT INTO public.cajeros (id_cajero, responsable, comision_porcentaje, activo, observaciones, nombre, importe_personalizado)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
            `;
            const valuesCajero = [idTercero, responsable || nombre, comision_porcentaje || 0, activo, observaciones, nombre_cajero || nombre, importe_personalizado];
            const { rows: [result] } = await client.query(queryCajero, valuesCajero);
            details = result;
        } else if (tipo === 'proveedor') {
            // ... tu lógica de 'proveedor' ...
            const { otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal } = specificData;
            const queryProveedor = `
                INSERT INTO public.proveedores (id, otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
            `;
            const valuesProveedor = [idTercero, otros_documentos, sitioweb, camara_comercio, rut, certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal || []];
            const { rows: [result] } = await client.query(queryProveedor, valuesProveedor);
            details = result;
        } else if (tipo === 'rrhh') {
            // ... tu lógica de 'rrhh' ...
            const { rut, certificado_bancario, medio_pago, cargo } = specificData;
            const queryRrhh = `
                INSERT INTO public.rrhh (id, rut, certificado_bancario, medio_pago, cargo)
                VALUES ($1, $2, $3, $4, $5) RETURNING *;
            `;
            const valuesRrhh = [idTercero, rut, certificado_bancario, medio_pago, cargo];
            const { rows: [result] } = await client.query(queryRrhh, valuesRrhh);
            details = result;
        }

        // --- 3. NUEVO: Inserción en 'cuentas_bancarias_terceros' ---
        let createdCuentas = [];
        if (cuentas_bancarias && cuentas_bancarias.length > 0) {
            console.log(`Insertando ${cuentas_bancarias.length} cuentas bancarias...`);
            
            const queryCuentas = `
                INSERT INTO public.cuentas_bancarias_terceros
                  (tercero_id, nombre_banco, numero_cuenta, tipo_cuenta, es_preferida)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;

            for (const cuenta of cuentas_bancarias) {
                // Validación básica
                if (!cuenta.nombre_banco || !cuenta.numero_cuenta) {
                    throw new Error('Cada cuenta bancaria debe tener al menos nombre_banco y numero_cuenta.');
                }
                
                const valuesCuenta = [
                    idTercero,
                    cuenta.nombre_banco,
                    cuenta.numero_cuenta,
                    cuenta.tipo_cuenta || null,
                    cuenta.es_preferida || false
                ];
                
                const { rows: [newCuenta] } = await client.query(queryCuentas, valuesCuenta);
                createdCuentas.push(newCuenta);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: `Tercero de tipo '${tipo}' creado exitosamente.`,
            // Combinamos el tercero, sus detalles y sus nuevas cuentas en la respuesta
            data: { ...newTercero, ...details, cuentas: createdCuentas } 
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

    const { workspaceId } = req.user;
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

        // CAMBIO: Iniciamos nuestras consultas con el workspaceId como primer parámetro.
        const queryParams = [workspaceId];
        let whereClauses = [`workspace_id = $1`]; // El filtro base y obligatorio.

        // Los siguientes filtros usarán los parámetros $2, $3, etc.
        if (search) {
            queryParams.push(`%${search}%`);
            whereClauses.push(`(COALESCE(nombre, '') || ' ' || COALESCE(numero_identificacion, '')) ILIKE $${queryParams.length}`);
        }

        if (tipo) {
            queryParams.push(tipo);
            whereClauses.push(`tipo = $${queryParams.length}`);
        }

        const whereString = `WHERE ${whereClauses.join(' AND ')}`;

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
                id, nombre, tipo, tipo_identificacion, numero_identificacion,
                direccion, ciudad, departamento, pais, telefono, correo,
                fecha_creacion, fecha_actualizacion, workspace_id
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
        // --- 1. PRIMERA CONSULTA: Obtener los datos 1 a 1 (Tu query actual) ---
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

        // --- 2. NUEVO: SEGUNDA CONSULTA: Obtener los datos 1 a N (Cuentas) ---
        const queryCuentas = `
            SELECT * FROM public.cuentas_bancarias_terceros
            WHERE tercero_id = $1
            ORDER BY es_preferida DESC, fecha_creacion ASC;
        `;
        // (Ordenamos para que el frontend muestre la 'preferida' de primero)
        
        const { rows: cuentasBancarias } = await client.query(queryCuentas, [id]);


        // --- 3. PROCESAR Y COMBINAR ---
        
        // (Tu lógica de renombrar campos es correcta, la mantenemos)
        if (fullData.tipo === 'proveedor') {
            fullData.rut = fullData.proveedor_rut;
            fullData.certificado_bancario = fullData.proveedor_cb;
            fullData.medio_pago = fullData.proveedor_mp;
        } else if (fullData.tipo === 'rrhh') {
            fullData.rut = fullData.rrhh_rut;
            fullData.certificado_bancario = fullData.rrhh_cb;
            fullData.medio_pago = fullData.rrhh_mp;
        }

        // --- NUEVO: Añadimos el array de cuentas al objeto principal ---
        fullData.cuentas = cuentasBancarias || []; // Aseguramos que siempre sea un array


        res.status(200).json({
            message: 'Tercero obtenido exitosamente',
            // El objeto 'data' ahora contiene toda la info + el array 'cuentas'
            data: fullData, 
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

        // --- 1. SEGURIDAD Y VALIDACIÓN ---
        const { workspaceId } = req.user;
        if (!workspaceId) {
            throw new Error('ERROR_DE_AUTENTICACION: El token no contiene un workspace_id.');
        }

        const {
            nombre, tipo: newType, tipo_identificacion, numero_identificacion,
            direccion, ciudad, departamento, pais,
            telefono, correo,
            cuentas_bancarias, // Capturamos las cuentas
            ...specificData
        } = req.body;

        // --- 2. OBTENER ESTADO ACTUAL (DE FORMA SEGURA) ---
        const { rows: [currentTercero] } = await client.query(
            'SELECT * FROM public.terceros WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
            [id, workspaceId]
        );

        if (!currentTercero) {
            throw new Error('ERROR_DE_NEGOCIO: Tercero no encontrado o sin permisos para editarlo.');
        }
        
        const currentType = currentTercero.tipo;

        // --- 3. ACTUALIZAR TABLA PRINCIPAL 'terceros' ---
        const updateTerceroQuery = `
            UPDATE public.terceros SET
                nombre = $1, tipo = $2, tipo_identificacion = $3, numero_identificacion = $4,
                direccion = $5, ciudad = $6, departamento = $7, pais = $8,
                telefono = $9, correo = $10
            WHERE id = $11 AND workspace_id = $12
            RETURNING *;
        `;
        const terceroValues = [
            nombre ?? currentTercero.nombre,
            newType ?? currentType, 
            tipo_identificacion ?? currentTercero.tipo_identificacion,
            numero_identificacion ?? currentTercero.numero_identificacion,
            direccion ?? currentTercero.direccion,
            ciudad ?? currentTercero.ciudad,
            departamento ?? currentTercero.departamento,
            pais ?? currentTercero.pais,
            telefono ?? currentTercero.telefono,
            correo ?? currentTercero.correo,
            id, workspaceId
        ];
        const { rows: [updatedTercero] } = await client.query(updateTerceroQuery, terceroValues);

        // --- 4. SINCRONIZAR 'cuentas_bancarias_terceros' ---
        if (cuentas_bancarias) {
            console.log(`Sincronizando cuentas bancarias para el tercero ${id}...`);
            
            const queryUpdateCuenta = `
                UPDATE public.cuentas_bancarias_terceros
                SET nombre_banco = $1, numero_cuenta = $2, tipo_cuenta = $3, es_preferida = $4, fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = $5 AND tercero_id = $6;
            `;
            const queryInsertCuenta = `
                INSERT INTO public.cuentas_bancarias_terceros
                  (nombre_banco, numero_cuenta, tipo_cuenta, es_preferida, tercero_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id;
            `;

            const { rows: currentCuentas } = await client.query('SELECT id FROM public.cuentas_bancarias_terceros WHERE tercero_id = $1', [id]);
            const dbAccountIds = new Set(currentCuentas.map(c => c.id));
            const requestAccountIds = new Set();

            for (const cuenta of cuentas_bancarias) {
                if (!cuenta.nombre_banco || !cuenta.numero_cuenta) {
                    throw new Error('Cada cuenta bancaria debe tener al menos nombre_banco y numero_cuenta.');
                }
                
                if (cuenta.id && dbAccountIds.has(cuenta.id)) {
                    // UPDATE
                    requestAccountIds.add(cuenta.id);
                    const values = [
                        cuenta.nombre_banco,
                        cuenta.numero_cuenta,
                        cuenta.tipo_cuenta || null,
                        cuenta.es_preferida || false,
                        cuenta.id,
                        id
                    ];
                    await client.query(queryUpdateCuenta, values);
                } else {
                    // INSERT
                    const values = [
                        cuenta.nombre_banco,
                        cuenta.numero_cuenta,
                        cuenta.tipo_cuenta || null,
                        cuenta.es_preferida || false,
                        id
                    ];
                    const { rows: [inserted] } = await client.query(queryInsertCuenta, values);
                    requestAccountIds.add(inserted.id);
                }
            }

            // DELETE
            const idsToDelete = [...dbAccountIds].filter(dbId => !requestAccountIds.has(dbId));
            
            if (idsToDelete.length > 0) {
                console.log(`Eliminando ${idsToDelete.length} cuentas obsoletas...`);
                await client.query(
                    'DELETE FROM public.cuentas_bancarias_terceros WHERE id = ANY($1::uuid[])', 
                    [idsToDelete]
                );
            }
        }

        // --- 5. MANEJAR ACTUALIZACIÓN DE TABLAS DE DETALLES ---
        let details = {};
        const finalType = updatedTercero.tipo;

        if (newType && newType !== currentType) {
            // Lógica para cambio de tipo (Eliminar antiguo, crear nuevo)
            console.log(`El tipo de tercero cambió de '${currentType}' a '${newType}'. Recreando detalles...`);
            if (currentType === 'cajero') await client.query('DELETE FROM public.cajeros WHERE id_cajero = $1', [id]);
            if (currentType === 'proveedor') await client.query('DELETE FROM public.proveedores WHERE id = $1', [id]);
            if (currentType === 'rrhh') await client.query('DELETE FROM public.rrhh WHERE id = $1', [id]);

            // Crear nuevo (aquí puedes añadir la lógica de inserción para proveedor y rrhh si lo deseas)
            if (finalType === 'cajero') {
                const { responsable, comision_porcentaje = 0, activo = true, observaciones, nombre_cajero, importe_personalizado = false } = specificData;
                const { rows: [result] } = await client.query('INSERT INTO public.cajeros (id_cajero, responsable, comision_porcentaje, activo, observaciones, nombre, importe_personalizado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;', [id, responsable ?? nombre, comision_porcentaje, activo, observaciones, nombre_cajero ?? nombre, importe_personalizado]);
                details = result;
            }
            // ... (Añadir lógica INSERT para proveedor y rrhh si es necesario)

        } else {
            // Lógica para actualización (El tipo NO cambió)
            console.log(`Actualizando detalles para el tipo '${finalType}'...`);
            
            if (finalType === 'cajero') {
                const { responsable, comision_porcentaje, activo, observaciones, nombre_cajero, importe_personalizado } = specificData;
                const { rows: [result] } = await client.query('UPDATE public.cajeros SET responsable=COALESCE($1, responsable), comision_porcentaje=COALESCE($2, comision_porcentaje), activo=COALESCE($3, activo), observaciones=COALESCE($4, observaciones), nombre=COALESCE($5, nombre), importe_personalizado=COALESCE($6, importe_personalizado) WHERE id_cajero = $7 RETURNING *;', [responsable, comision_porcentaje, activo, observaciones, nombre_cajero, importe_personalizado, id]);
                details = result;
            }
            
            // --- 👇 AQUÍ ESTÁ LA CORRECCIÓN ---
            if (finalType === 'proveedor') {
                const { 
                    otros_documentos, sitioweb, camara_comercio, rut, 
                    certificado_bancario, medio_pago, responsable_iva, responsabilidad_fiscal 
                } = specificData;
                
                const query = `
                    UPDATE public.proveedores 
                    SET 
                        otros_documentos = COALESCE($1, otros_documentos), 
                        sitioweb = COALESCE($2, sitioweb), 
                        camara_comercio = COALESCE($3, camara_comercio), 
                        rut = COALESCE($4, rut), 
                        certificado_bancario = COALESCE($5, certificado_bancario), 
                        medio_pago = COALESCE($6, medio_pago), 
                        responsable_iva = COALESCE($7, responsable_iva), 
                        responsabilidad_fiscal = COALESCE($8, responsabilidad_fiscal)
                    WHERE id = $9 
                    RETURNING *;
                `;
                const values = [
                    otros_documentos, sitioweb, camara_comercio, rut, 
                    certificado_bancario, medio_pago, responsable_iva, 
                    responsabilidad_fiscal, id
                ];
                
                const { rows: [result] } = await client.query(query, values);
                details = result;
            }
            
            // --- 👇 Y AQUÍ TAMBIÉN ---
            if (finalType === 'rrhh') {
                const { rut, certificado_bancario, medio_pago, cargo } = specificData;
                
                const query = `
                    UPDATE public.rrhh 
                    SET 
                        rut = COALESCE($1, rut), 
                        certificado_bancario = COALESCE($2, certificado_bancario), 
                        medio_pago = COALESCE($3, medio_pago), 
                        cargo = COALESCE($4, cargo)
                    WHERE id = $5 
                    RETURNING *;
                `;
                const values = [rut, certificado_bancario, medio_pago, cargo, id];

                const { rows: [result] } = await client.query(query, values);
                details = result;
            }
        }
        
        // --- 6. OBTENER ESTADO FINAL ---
        const { rows: finalCuentas } = await client.query(
            'SELECT * FROM public.cuentas_bancarias_terceros WHERE tercero_id = $1 ORDER BY fecha_creacion ASC', 
            [id]
        );

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Tercero actualizado exitosamente',
            data: { ...updatedTercero, ...details, cuentas: finalCuentas }
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error en updateTercero:', error);
        
        let statusCode = 500;
        let userErrorMessage = 'Error interno del servidor';
        let userErrorDetails = error.message;

        if (error.message.startsWith('ERROR_')) {
            const [type] = error.message.replace('ERROR_', '').split(':');
            statusCode = (type === 'DE_VALIDACION' || type === 'DE_NEGOCIO') ? 400 : (type === 'DE_AUTENTICACION' ? 401 : 500);
            userErrorMessage = error.message;
        }
        
        res.status(statusCode).json({ error: userErrorMessage, details: userErrorDetails });

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
    // NUEVO: Obtenemos el workspaceId del token del usuario.
    const { workspaceId } = req.user;

    let client;
    try {
        client = await pool.connect();

        // CAMBIO: Todas las consultas ahora aceptan un parámetro para el workspace_id.
        const conteoPorTipoQuery = client.query(`
            SELECT COALESCE(tipo, 'Sin Asignar') as tipo, COUNT(*) as cantidad
            FROM public.terceros 
            WHERE workspace_id = $1 
            GROUP BY 1 ORDER BY cantidad DESC;
        `, [workspaceId]);

        const conteoPorCiudadQuery = client.query(`
            SELECT COALESCE(ciudad, 'Sin Ciudad') as ciudad, COUNT(*) as cantidad 
            FROM public.terceros 
            WHERE workspace_id = $1 
            GROUP BY ciudad ORDER BY cantidad DESC LIMIT 5;
        `, [workspaceId]);

        const calidadDatosQuery = client.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE correo IS NULL OR correo = '{}'::jsonb) AS sin_correo,
                COUNT(*) FILTER (WHERE telefono IS NULL OR telefono = '{}'::jsonb) AS sin_telefono
            FROM public.terceros
            WHERE workspace_id = $1;
        `, [workspaceId]);

        const tercerosRecientesQuery = client.query(`
            SELECT id, nombre, tipo, fecha_creacion 
            FROM public.terceros 
            WHERE workspace_id = $1 
            ORDER BY fecha_creacion DESC 
            LIMIT 5;
        `, [workspaceId]);

        // La ejecución en paralelo se mantiene, es muy eficiente.
        const [
            conteoPorTipoResult,
            conteoPorCiudadResult,
            calidadDatosResult,
            tercerosRecientesResult
        ] = await Promise.all([
            conteoPorTipoQuery,
            conteoPorCiudadQuery,
            calidadDatosQuery,
            tercerosRecientesQuery
        ]);

        // El procesamiento de los resultados se mantiene igual.
        const calidadDatos = calidadDatosResult.rows[0];
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
                tercerosRecientes: tercerosRecientesResult.rows,
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