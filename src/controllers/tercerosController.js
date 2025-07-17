import pool from '../database.js'; // Adjust this path to your actual DB connection pool.
import { v4 as uuidv4 } from 'uuid'; // Import uuid for generating unique IDs

/**
 * @function createTercero
 * @description Crea un nuevo registro en la tabla 'terceros' y, opcionalmente, en tablas relacionadas (cajeros, proveedores, rrhh).
 * @param {object} req - Objeto de solicitud de Express (espera 'nombre', 'tipo' y datos específicos para 'cajero'/'proveedor'/'rrhh' en req.body).
 * @param {object} res - Objeto de respuesta de Express.
 */
export const createTercero = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nombre, tipo, ...restOfBody } = req.body;

    // ... (general validation and logic) ...

    const idTercero = uuidv4();
    const queryTercero = `INSERT INTO terceros (id, nombre, tipo) VALUES ($1, $2, $3) RETURNING *;`;
    const valuesTercero = [idTercero, nombre, tipo];
    const resultTercero = await client.query(queryTercero, valuesTercero);

    let relatedData = null;

    if (tipo === 'cajero') {
      // ... (cajero logic - no changes needed here, as it's working) ...

    } else if (tipo === 'proveedor' || tipo === 'rrhh') {
      const {
        tipo_identificacion,
        numero_identificacion,
        nombre_comercial,
        nombres_contacto,
        apellidos_contacto,
        direccion,
        ciudad,
        estado,
        departamento,
        correo,
        otros_documentos,
        fecha_vencimiento,
        sitioweb,
        pais,
        tipo: specificType,
        camara_comercio,
        rut,
        certificado_bancario,
        medio_pago,
        telefono,
        responsable_iva,
        responsabilidad_fiscal,
      } = restOfBody;

      // --- DEBUGGING CRÍTICO ---
      console.log('DEBUG: Tipo de dato de "correo":', typeof correo, 'Valor:', correo);
      console.log('DEBUG: Es "correo" un Array?', Array.isArray(correo));
      console.log('DEBUG: Tipo de dato de "telefono":', typeof telefono, 'Valor:', telefono);
      console.log('DEBUG: Es "telefono" un Array?', Array.isArray(telefono));
      console.log('DEBUG: Tipo de dato de "responsabilidad_fiscal":', typeof responsabilidad_fiscal, 'Valor:', responsabilidad_fiscal);
      console.log('DEBUG: Es "responsabilidad_fiscal" un Array?', Array.isArray(responsabilidad_fiscal));
      // --- FIN DEBUGGING CRÍTICO ---

      // ... (specific validations for proveedor/rrhh) ...

      const tableName = tipo === 'proveedor' ? 'proveedores' : 'rrhh';
      const querySpecificTable = `
        INSERT INTO ${tableName} (
          id, tipo_identificacion, numero_identificacion, nombre_comercial,
          nombres_contacto, apellidos_contacto, direccion, ciudad, estado,
          departamento, correo, otros_documentos, fecha_vencimiento, sitioweb,
          pais, tipo, camara_comercio, rut, certificado_bancario, medio_pago,
          telefono, responsable_iva, responsabilidad_fiscal
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *;
      `;
      const valuesSpecificTable = [
        idTercero,
        tipo_identificacion,
        numero_identificacion,
        nombre_comercial,
        nombres_contacto,
        apellidos_contacto,
        direccion,
        ciudad,
        estado || 'activo',
        departamento || null,
        correo ? JSON.stringify(correo) : null, // <--- CAMBIO CLAVE AQUÍ
        otros_documentos || null,
        fecha_vencimiento || null,
        sitioweb || null,
        pais || null,
        specificType || tipo,
        camara_comercio || null,
        rut || null,
        certificado_bancario || null,
        medio_pago || null,
        telefono ? JSON.stringify(telefono) : null, // <--- Y AQUÍ
        responsable_iva || null,
        responsabilidad_fiscal ? JSON.stringify(responsabilidad_fiscal) : null, // <--- Y AQUÍ
      ];

      console.log(`Valores finales (stringified) para insertar en ${tableName}:`, valuesSpecificTable);
      const resultSpecificTable = await client.query(querySpecificTable, valuesSpecificTable);
      relatedData = resultSpecificTable.rows[0];
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `Tercero de tipo '${tipo}' creado exitosamente`,
      data: {
        tercero: resultTercero.rows[0],
        relatedData: relatedData,
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createTercero:', error);
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


export const updateTercero = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const {
            nombre,
            tipo, // Este es el 'tipo' que viene en el request body
            ...specificFields // Captura el resto de campos que pueden ser específicos
        } = req.body;

        // 1. Obtener el tipo actual del tercero y sus datos completos
        const getTerceroInfoQuery = `
            SELECT nombre, tipo FROM terceros WHERE id = $1;
        `;
        const resultTerceroInfo = await client.query(getTerceroInfoQuery, [id]);

        if (resultTerceroInfo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                error: 'Tercero no encontrado',
                details: `No se encontró un tercero con el ID: ${id}`,
            });
        }
        const currentTercero = resultTerceroInfo.rows[0];
        const currentTerceroType = currentTercero.tipo;
        // const currentTerceroName = currentTercero.nombre; // No se usa directamente después de esta línea


        // Asegúrate de que estas variables estén declaradas aquí, al inicio del try
        let updateTerceroFields = [];
        let updateTerceroValues = [];
        let index = 1; // Para los parámetros de la consulta de 'terceros'


        let updatedTerceroResult = null;
        let updatedRelatedData = null;

        // --- LÓGICA DE MIGRACIÓN DE TIPO ---
        if (tipo !== undefined && tipo !== currentTerceroType) {
            console.log(`DEBUG: Iniciando migración de tipo. De '${currentTerceroType}' a '${tipo}' para ID: ${id}`);

            // 1. Obtener los datos completos del registro actual en su tabla específica
            let oldRecordData = null;
            if (currentTerceroType === 'cajero') {
                const result = await client.query('SELECT * FROM cajeros WHERE id_cajero = $1', [id]);
                if (result.rows.length > 0) oldRecordData = result.rows[0];
            } else if (currentTerceroType === 'proveedor') {
                const result = await client.query('SELECT * FROM proveedores WHERE id = $1', [id]);
                if (result.rows.length > 0) oldRecordData = result.rows[0];
            } else if (currentTerceroType === 'rrhh') {
                const result = await client.query('SELECT * FROM rrhh WHERE id = $1', [id]);
                if (result.rows.length > 0) oldRecordData = result.rows[0];
            }
            console.log('DEBUG: oldRecordData recuperado:', oldRecordData);

            // Si no se encontró el registro antiguo en su tabla específica, algo está mal.
            if (!oldRecordData) {
                await client.query('ROLLBACK');
                return res.status(500).json({
                    error: 'Error de integridad de datos',
                    details: `El tercero ${id} es de tipo '${currentTerceroType}' pero no se encontró un registro asociado en la tabla '${currentTerceroType}s'. No se pudo migrar.`,
                });
            }

            // 2. Eliminar el registro de la tabla de origen
            let deleteQuery = '';
            let deleteTableName = ''; // Para logs
            if (currentTerceroType === 'cajero') {
                await client.query('DELETE FROM importes_personalizados WHERE id_cajero = $1', [id]);
                deleteQuery = 'DELETE FROM cajeros WHERE id_cajero = $1';
                deleteTableName = 'cajeros';
            } else if (currentTerceroType === 'proveedor') {
                deleteQuery = 'DELETE FROM proveedores WHERE id = $1';
                deleteTableName = 'proveedores';
            } else if (currentTerceroType === 'rrhh') {
                deleteQuery = 'DELETE FROM rrhh WHERE id = $1';
                deleteTableName = 'rrhh';
            }
            if (deleteQuery) {
                const deleteResult = await client.query(deleteQuery, [id]);
                console.log(`DEBUG: Eliminado de ${deleteTableName}. Filas afectadas: ${deleteResult.rowCount}`);
                if (deleteResult.rowCount === 0) {
                     console.warn(`WARN: Intento de eliminar de ${deleteTableName} para ID ${id} resultó en 0 filas afectadas. ¿Ya no existía?`);
                }
            }

            // 3. Insertar en la nueva tabla de destino
            let insertTableName = ''; // Para logs
            if (tipo === 'cajero') {
                insertTableName = 'cajeros';
                // Prepara los datos para insertar en cajeros
                const cajeroValues = [
                    id, // Usar el mismo ID
                    nombre !== undefined ? nombre : oldRecordData.nombre, // Usar nombre del body si existe, sino el antiguo
                    specificFields.responsable !== undefined ? specificFields.responsable : oldRecordData.responsable,
                    specificFields.municipio !== undefined ? specificFields.municipio : oldRecordData.municipio,
                    specificFields.direccion !== undefined ? specificFields.direccion : oldRecordData.direccion,
                    specificFields.comision_porcentaje !== undefined ? specificFields.comision_porcentaje : oldRecordData.comision_porcentaje,
                    specificFields.observaciones !== undefined ? specificFields.observaciones : oldRecordData.observaciones,
                    specificFields.activo !== undefined ? specificFields.activo : oldRecordData.activo,
                    (Array.isArray(specificFields.importesPersonalizados) && specificFields.importesPersonalizados.length > 0) || oldRecordData.importe_personalizado, // Mantiene el flag
                ];
                console.log(`DEBUG: Insertando en ${insertTableName} con valores:`, cajeroValues);
                const insertQuery = `
                    INSERT INTO cajeros (id_cajero, nombre, responsable, municipio, direccion, comision_porcentaje, observaciones, activo, importe_personalizado)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
                `;
                const result = await client.query(insertQuery, cajeroValues);
                updatedRelatedData = result.rows[0];
                console.log(`DEBUG: Insertado en ${insertTableName}. Nuevo registro:`, updatedRelatedData);

                // Manejo de importes personalizados para el nuevo cajero (si se proveen o si el antiguo tenía)
                if (Array.isArray(specificFields.importesPersonalizados) || (currentTerceroType === 'cajero' && oldRecordData.importe_personalizado)) {
                    // Si viene nuevos importes, úsalos; si no, intenta migrar los antiguos si existían
                    const importesToInsert = Array.isArray(specificFields.importesPersonalizados)
                        ? specificFields.importesPersonalizados
                        : (currentTerceroType === 'cajero' ? await client.query('SELECT producto, accion, valor FROM importes_personalizados WHERE id_cajero = $1', [id]).then(res => res.rows) : []);

                    if (importesToInsert.length > 0) {
                        console.log('DEBUG: Insertando importes personalizados:', importesToInsert);
                        const insertImportesQuery = `
                            INSERT INTO importes_personalizados (id_importe, id_cajero, producto, accion, valor)
                            VALUES ${importesToInsert.map((_, i) =>
                                `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
                            ).join(', ')}
                        `;
                        const valuesImportes = importesToInsert.flatMap(item => [
                            uuidv4(),
                            id,
                            item.producto || item.product,
                            item.accion || item.action,
                            item.valor || item.value,
                        ]);
                        await client.query(insertImportesQuery, valuesImportes);
                    }
                }

            } else if (tipo === 'proveedor' || tipo === 'rrhh') {
                insertTableName = tipo === 'proveedor' ? 'proveedores' : 'rrhh';

                // Prepara los datos para insertar en proveedores/rrhh
                const commonSpecificValues = [
                    id, // Usar el mismo ID
                    specificFields.tipo_identificacion !== undefined ? specificFields.tipo_identificacion : oldRecordData.tipo_identificacion,
                    specificFields.numero_identificacion !== undefined ? specificFields.numero_identificacion : oldRecordData.numero_identificacion,
                    // Si el nombre del body existe, se usa. Si no, se usa el nombre_comercial del registro antiguo.
                    // Si el nombre del body es undefined y oldRecordData.nombre_comercial es undefined, se toma oldRecordData.nombre.
                    specificFields.nombre_comercial !== undefined ? specificFields.nombre_comercial : (oldRecordData.nombre_comercial !== undefined ? oldRecordData.nombre_comercial : oldRecordData.nombre),
                    specificFields.nombres_contacto !== undefined ? specificFields.nombres_contacto : oldRecordData.nombres_contacto,
                    specificFields.apellidos_contacto !== undefined ? specificFields.apellidos_contacto : oldRecordData.apellidos_contacto,
                    specificFields.direccion !== undefined ? specificFields.direccion : oldRecordData.direccion,
                    specificFields.ciudad !== undefined ? specificFields.ciudad : oldRecordData.ciudad,
                    specificFields.estado !== undefined ? specificFields.estado : (oldRecordData.estado || 'activo'),
                    specificFields.departamento !== undefined ? specificFields.departamento : (oldRecordData.departamento || null),
                    (specificFields.correo !== undefined && specificFields.correo !== null) ? JSON.stringify(specificFields.correo) : (oldRecordData.correo ? JSON.stringify(oldRecordData.correo) : null), // Se espera JSON.stringify
                    specificFields.otros_documentos !== undefined ? specificFields.otros_documentos : (oldRecordData.otros_documentos || null),
                    specificFields.fecha_vencimiento !== undefined ? specificFields.fecha_vencimiento : (oldRecordData.fecha_vencimiento || null),
                    specificFields.sitioweb !== undefined ? specificFields.sitioweb : (oldRecordData.sitioweb || null),
                    specificFields.pais !== undefined ? specificFields.pais : (oldRecordData.pais || null),
                    tipo, // El nuevo tipo (ej. 'rrhh')
                    specificFields.camara_comercio !== undefined ? specificFields.camara_comercio : (oldRecordData.camara_comercio || null),
                    specificFields.rut !== undefined ? specificFields.rut : (oldRecordData.rut || null),
                    specificFields.certificado_bancario !== undefined ? specificFields.certificado_bancario : (oldRecordData.certificado_bancario || null),
                    specificFields.medio_pago !== undefined ? specificFields.medio_pago : (oldRecordData.medio_pago || null),
                    (specificFields.telefono !== undefined && specificFields.telefono !== null) ? JSON.stringify(specificFields.telefono) : (oldRecordData.telefono ? JSON.stringify(oldRecordData.telefono) : null), // Se espera JSON.stringify
                    specificFields.responsable_iva !== undefined ? specificFields.responsable_iva : (oldRecordData.responsable_iva || null),
                    (specificFields.responsabilidad_fiscal !== undefined && specificFields.responsabilidad_fiscal !== null) ? JSON.stringify(specificFields.responsabilidad_fiscal) : (oldRecordData.responsabilidad_fiscal ? JSON.stringify(oldRecordData.responsabilidad_fiscal) : null), // Se espera JSON.stringify
                ];

                console.log(`DEBUG: Insertando en ${insertTableName} con valores:`, commonSpecificValues);
                const insertSpecificTableQuery = `
                    INSERT INTO ${insertTableName} (
                        id, tipo_identificacion, numero_identificacion, nombre_comercial,
                        nombres_contacto, apellidos_contacto, direccion, ciudad, estado,
                        departamento, correo, otros_documentos, fecha_vencimiento, sitioweb,
                        pais, tipo, camara_comercio, rut, certificado_bancario, medio_pago,
                        telefono, responsable_iva, responsabilidad_fiscal
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                            $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *;
                `;
                const result = await client.query(insertSpecificTableQuery, commonSpecificValues);
                updatedRelatedData = result.rows[0];
                console.log(`DEBUG: Insertado en ${insertTableName}. Nuevo registro:`, updatedRelatedData);
            } else {
                // Manejar otros tipos si son necesarios o un error si el nuevo tipo es desconocido
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: 'Tipo de tercero no soportado para migración',
                    details: `El nuevo tipo '${tipo}' no está implementado para la migración.`,
                });
            }

            // 4. Actualizar el tipo en la tabla 'terceros'
            // Esto se asegura de que el 'tipo' también se añada a la actualización de la tabla 'terceros'
            // Se hace aquí para que el campo 'tipo' en la tabla 'terceros' se actualice al final de la migración exitosa
            updateTerceroFields.push(`tipo = $${index}`);
            updateTerceroValues.push(tipo);
            index++;

        }
        // --- FIN LÓGICA DE MIGRACIÓN DE TIPO ---


        // --- LÓGICA DE ACTUALIZACIÓN DE CAMPOS GENÉRICOS DE TERCEROS ---
        // Se añade 'nombre' a la lista de campos a actualizar en 'terceros'
        // Esto se hace solo si 'nombre' está presente y no se añadió ya por la migración del tipo.
        if (nombre !== undefined && (tipo === undefined || tipo === currentTerceroType)) {
             // Si no hubo cambio de tipo, pero el nombre sí se actualiza
             updateTerceroFields.push(`nombre = $${index}`);
             updateTerceroValues.push(nombre);
             index++;
        }
        // Nota: Si hubo cambio de tipo y el nombre fue incluido en el body,
        // ya se actualizó en la tabla de destino y el 'nombre' del maestro se actualizará
        // con la misma lógica que el 'tipo' si 'nombre' está en updateTerceroFields.


        // Construir y ejecutar la consulta de actualización para la tabla 'terceros'
        if (updateTerceroFields.length > 0) {
            updateTerceroValues.push(id);
            const updateTerceroQuery = `
                UPDATE terceros
                SET ${updateTerceroFields.join(', ')}
                WHERE id = $${index}
                RETURNING *;
            `;
            const result = await client.query(updateTerceroQuery, updateTerceroValues);
            if (result.rows.length === 0) {
                 await client.query('ROLLBACK');
                 return res.status(404).json({ error: 'Tercero no encontrado durante la actualización maestra.' });
            }
            updatedTerceroResult = result.rows[0];
        } else {
            // Si no hay campos para actualizar en 'terceros' (ni nombre ni tipo), se mantiene el actual.
            updatedTerceroResult = currentTercero;
        }


        // --- LÓGICA DE ACTUALIZACIÓN DE DATOS ESPECÍFICOS (si NO hubo migración) ---
        // Este bloque SOLO se ejecuta si NO hubo un cambio de tipo (tipo === undefined || tipo === currentTerceroType)
        // Si hubo cambio de tipo, updatedRelatedData ya fue establecido por la lógica de migración
        if (tipo === undefined || tipo === currentTerceroType) {
            if (currentTerceroType === 'cajero') {
                const {
                    responsable, municipio, direccion, comision_porcentaje,
                    observaciones, activo, importesPersonalizados,
                } = specificFields;

                let updateCajeroFields = [];
                let cajeroValues = [];
                let cajeroIndex = 1;

                if (nombre !== undefined) {
                    updateCajeroFields.push(`nombre = $${cajeroIndex}`);
                    cajeroValues.push(nombre);
                    cajeroIndex++;
                }

                const cajeroFieldMappings = { responsable, municipio, direccion, comision_porcentaje, observaciones, activo };
                for (const [field, value] of Object.entries(cajeroFieldMappings)) {
                    if (value !== undefined) {
                        updateCajeroFields.push(`${field} = $${cajeroIndex}`);
                        cajeroValues.push(value);
                        cajeroIndex++;
                    }
                }

                if (updateCajeroFields.length > 0) {
                    cajeroValues.push(id);
                    const updateCajeroQuery = `
                        UPDATE cajeros SET ${updateCajeroFields.join(', ')} WHERE id_cajero = $${cajeroIndex} RETURNING *;
                    `;
                    const resultCajero = await client.query(updateCajeroQuery, cajeroValues);
                    updatedRelatedData = resultCajero.rows[0];
                }

                if (Array.isArray(importesPersonalizados)) {
                    await client.query('DELETE FROM importes_personalizados WHERE id_cajero = $1', [id]);
                    if (importesPersonalizados.length > 0) {
                        const insertQuery = `
                            INSERT INTO importes_personalizados (id_importe, id_cajero, producto, accion, valor)
                            VALUES ${importesPersonalizados.map((_, i) =>
                                `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
                            ).join(', ')}
                        `;
                        const valuesImportes = importesPersonalizados.flatMap(item => [
                            uuidv4(), id, item.producto || item.product, item.accion || item.action, item.valor || item.value,
                        ]);
                        await client.query(insertQuery, valuesImportes);
                    }
                }

                const getUpdatedCajeroQuery = `
                    SELECT
                        c.id_cajero, c.nombre, c.responsable, c.municipio, c.direccion,
                        c.comision_porcentaje, c.observaciones, c.activo,
                        json_agg(json_build_object('id_importe', ip.id_importe, 'producto', ip.producto, 'accion', ip.accion, 'valor', ip.valor))
                        FILTER (WHERE ip.id_importe IS NOT NULL) AS importes_personalizados
                    FROM cajeros c LEFT JOIN importes_personalizados ip ON c.id_cajero = ip.id_cajero
                    WHERE c.id_cajero = $1
                    GROUP BY c.id_cajero, c.nombre, c.responsable, c.municipio, c.direccion, c.comision_porcentaje, c.observaciones, c.activo;
                `;
                const finalCajeroResult = await client.query(getUpdatedCajeroQuery, [id]);
                updatedRelatedData = {
                    ...finalCajeroResult.rows[0],
                    importes_personalizados: finalCajeroResult.rows[0].importes_personalizados || [],
                };

            } else if (currentTerceroType === 'proveedor' || currentTerceroType === 'rrhh') {
                const {
                    tipo_identificacion, numero_identificacion, nombre_comercial, nombres_contacto,
                    apellidos_contacto, direccion, ciudad, estado, departamento, correo,
                    otros_documentos, fecha_vencimiento, sitioweb, pais, tipo: specificType,
                    camara_comercio, rut, certificado_bancario, medio_pago, telefono,
                    responsable_iva, responsabilidad_fiscal,
                } = specificFields;

                const tableName = currentTerceroType === 'proveedor' ? 'proveedores' : 'rrhh';
                let updateSpecificTableFields = [];
                let specificTableValues = [];
                let specificTableIndex = 1;

                if (nombre !== undefined && specificFields.nombre_comercial === undefined) {
                    updateSpecificTableFields.push(`nombre_comercial = $${specificTableIndex}`);
                    specificTableValues.push(nombre);
                    specificTableIndex++;
                }

                const specificFieldMappings = {
                    tipo_identificacion, numero_identificacion, nombre_comercial: specificFields.nombre_comercial,
                    nombres_contacto, apellidos_contacto, direccion, ciudad, estado, departamento,
                    correo, otros_documentos, fecha_vencimiento, sitioweb, pais, tipo: specificType,
                    camara_comercio, rut, certificado_bancario, medio_pago, telefono,
                    responsable_iva, responsabilidad_fiscal,
                };

                for (const [field, value] of Object.entries(specificFieldMappings)) {
                    if (value !== undefined) {
                        updateSpecificTableFields.push(`${field} = $${specificTableIndex}`);
                        if (['correo', 'telefono', 'responsabilidad_fiscal'].includes(field) && value !== null) {
                            specificTableValues.push(JSON.stringify(value));
                        } else {
                            specificTableValues.push(value);
                        }
                        specificTableIndex++;
                    }
                }

                if (updateSpecificTableFields.length > 0) {
                    specificTableValues.push(id);
                    const updateSpecificTableQuery = `
                        UPDATE ${tableName} SET ${updateSpecificTableFields.join(', ')} WHERE id = $${specificTableIndex} RETURNING *;
                    `;
                    const resultSpecificTable = await client.query(updateSpecificTableQuery, specificTableValues);
                    updatedRelatedData = resultSpecificTable.rows[0];
                }
            }
        }

        await client.query('COMMIT');

        res.status(200).json({
            message: `Tercero de tipo '${updatedTerceroResult.tipo}' actualizado exitosamente`,
            data: {
                tercero: updatedTerceroResult,
                relatedData: updatedRelatedData,
            },
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en updateTercero:', error);
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

export const deleteTercero = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Iniciar la transacción
        const { id } = req.params; // ID del tercero a eliminar

        // 1. Obtener el tipo de tercero antes de eliminarlo para saber qué tablas dependientes afectar
        const getTerceroTypeQuery = `
      SELECT tipo FROM terceros WHERE id = $1;
    `;
        const resultType = await client.query(getTerceroTypeQuery, [id]);

        if (resultType.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                error: 'Tercero no encontrado',
                details: `No se encontró un tercero con el ID: ${id}`,
            });
        }

        const tipoTercero = resultType.rows[0].tipo;

        // 2. Eliminar de tablas dependientes según el tipo
        let relatedRecordsDeleted = 0; // Para contar los registros eliminados en tablas relacionadas

        if (tipoTercero === 'cajero') {
            // Eliminar importes personalizados asociados al cajero primero
            await client.query('DELETE FROM importes_personalizados WHERE id_cajero = $1', [id]);
            // Eliminar el cajero
            const resultCajero = await client.query('DELETE FROM cajeros WHERE id_cajero = $1 RETURNING id_cajero', [id]);
            relatedRecordsDeleted = resultCajero.rowCount;
            if (relatedRecordsDeleted === 0) {
                // Esto indica una inconsistencia: el tercero existe pero el cajero asociado no.
                await client.query('ROLLBACK');
                return res.status(500).json({
                    error: 'Error de integridad de datos',
                    details: `El tercero ${id} es de tipo 'cajero' pero no se encontró un registro en la tabla 'cajeros'.`,
                });
            }
        } else if (tipoTercero === 'proveedor') {
            // Eliminar el proveedor
            const resultProveedor = await client.query('DELETE FROM proveedores WHERE id = $1 RETURNING id', [id]);
            relatedRecordsDeleted = resultProveedor.rowCount;
            if (relatedRecordsDeleted === 0) {
                // Inconsistencia: el tercero existe pero el proveedor asociado no.
                await client.query('ROLLBACK');
                return res.status(500).json({
                    error: 'Error de integridad de datos',
                    details: `El tercero ${id} es de tipo 'proveedor' pero no se encontró un registro en la tabla 'proveedores'.`,
                });
            }
        } else if (tipoTercero === 'rrhh') {
            // Eliminar el rrhh
            const resultRRHH = await client.query('DELETE FROM rrhh WHERE id = $1 RETURNING id', [id]);
            relatedRecordsDeleted = resultRRHH.rowCount;
            if (relatedRecordsDeleted === 0) {
                // Inconsistencia: el tercero existe pero el rrhh asociado no.
                await client.query('ROLLBACK');
                return res.status(500).json({
                    error: 'Error de integridad de datos',
                    details: `El tercero ${id} es de tipo 'rrhh' pero no se encontró un registro en la tabla 'rrhh'.`,
                });
            }
        }
        // Puedes añadir más `else if` para otros tipos de terceros

        // 3. Finalmente, eliminar el tercero de la tabla `terceros`
        const resultTercero = await client.query('DELETE FROM terceros WHERE id = $1 RETURNING id', [id]);

        if (resultTercero.rowCount === 0) {
            // Esto solo debería ocurrir si el tercero fue eliminado concurrentemente o si hubo un problema
            // después de la verificación inicial.
            await client.query('ROLLBACK');
            return res.status(404).json({
                error: 'Tercero no eliminado',
                details: `El tercero con ID: ${id} no pudo ser eliminado (posiblemente ya no existe).`,
            });
        }

        await client.query('COMMIT'); // Confirmar la transacción
        res.status(200).json({
            message: `Tercero de tipo '${tipoTercero}' y sus datos relacionados eliminados correctamente`,
            deletedId: id,
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Revertir la transacción en caso de error
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