import pool from "../database.js";
import { v4 as uuidv4 } from 'uuid';


export const createCajero = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      nombre,
      responsable,
      municipio,
      direccion,
      comision_porcentaje,
      observaciones,
      importesPersonalizados,
    } = req.body;

    if (!nombre || !responsable || !municipio || !direccion || comision_porcentaje === undefined) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos nombre, responsable, municipio, direccion y comision_porcentaje son obligatorios',
      });
    }

    if (typeof comision_porcentaje !== 'number' || comision_porcentaje < 0 || comision_porcentaje > 100) {
      return res.status(400).json({
        error: 'Porcentaje de comisión inválido',
        details: 'El porcentaje de comisión debe ser un número entre 0 y 100',
      });
    }

    const idCajero = uuidv4();

    // Insertar en cajeros
    const queryCajero = `
      INSERT INTO cajeros (
        id_cajero, nombre, responsable, municipio, direccion,
        comision_porcentaje, observaciones, activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const valuesCajero = [
      idCajero,
      nombre,
      responsable,
      municipio,
      direccion,
      comision_porcentaje,
      observaciones || null,
      true,
    ];
    const resultCajero = await client.query(queryCajero, valuesCajero);

    // Insertar en terceros usando el mismo ID
    const queryTercero = `
      INSERT INTO terceros (id, nombre, tipo)
      VALUES ($1, $2, $3);
    `;
    const valuesTercero = [idCajero, nombre, 'cajero'];
    await client.query(queryTercero, valuesTercero);

    // Insertar importes personalizados si existen
    if (Array.isArray(importesPersonalizados) && importesPersonalizados.length > 0) {
      const queryImportes = `
        INSERT INTO importes_personalizados (id_importe, id_cajero, producto, accion, valor)
        VALUES ${importesPersonalizados.map((_, i) =>
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
        ).join(', ')}
        RETURNING *;
      `;
      const valuesImportes = importesPersonalizados.flatMap(item => [
        uuidv4(),
        idCajero,
        item.producto || item.product,
        item.accion || item.action,
        item.valor || item.value,
      ]);
      await client.query(queryImportes, valuesImportes);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Cajero creado exitosamente',
      data: resultCajero.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en createCajero:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};


// 2. OBTENER TODOS LOS CAJEROS
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

// 3. OBTENER UN CAJERO POR ID
export const getCajeroById = async (req, res) => {
    // 1. OBTENER Y VALIDAR EL ID DE LOS PARÁMETROS DE LA RUTA
    const { id } = req.params;

    // Opcional pero recomendado: Validar si el ID tiene formato de UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'El ID proporcionado no es un UUID válido.' });
    }

    let client;
    try {
        client = await pool.connect();

        // 2. CONSTRUIR LA CONSULTA SQL PARAMETRIZADA
        // Usamos $1 como placeholder para el ID. Esto previene inyecciones SQL.
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
                t.id = $1 AND t.tipo = 'cajero' -- Doble condición para mayor seguridad e integridad
            LIMIT 1; -- Buena práctica para indicar que solo esperamos un resultado
        `;

        // 3. EJECUTAR LA CONSULTA PASANDO EL ID COMO PARÁMETRO
        const dataResult = await client.query(dataQuery, [id]);

        // 4. MANEJAR LA RESPUESTA
        // Si no se encontraron filas, el cajero no existe.
        if (dataResult.rowCount === 0) {
            return res.status(404).json({ message: 'No se encontró un cajero con el ID proporcionado.' });
        }

        // Si se encontró, devolver el primer (y único) registro.
        res.status(200).json({
            message: 'Cajero obtenido exitosamente.',
            data: dataResult.rows[0],
        });

    } catch (error) {
        console.error(`Error en getCajeroById para el ID ${id}:`, error);
        res.status(500).json({
            error: 'Ocurrió un error inesperado al obtener el cajero.',
            details: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const updateCajero = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      nombre,
      responsable,
      municipio,
      direccion,
      comision_porcentaje,
      observaciones,
      activo,
      importesPersonalizados,
    } = req.body;

    if (
      !nombre &&
      !responsable &&
      !municipio &&
      !direccion &&
      comision_porcentaje === undefined &&
      observaciones === undefined &&
      activo === undefined &&
      (!Array.isArray(importesPersonalizados) || importesPersonalizados.length === 0)
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Ningún campo proporcionado para actualizar',
        details: 'Debes proporcionar al menos un campo o importes personalizados para actualizar',
      });
    }

    let updateFields = [];
    let values = [];
    let index = 1;

    const fieldMappings = {
      nombre,
      responsable,
      municipio,
      direccion,
      comision_porcentaje,
      observaciones,
      activo,
    };

    for (const [field, value] of Object.entries(fieldMappings)) {
      if (value !== undefined) {
        updateFields.push(`${field} = $${index}`);
        values.push(value);
        index++;
      }
    }

    values.push(id);

    let updatedCajero;
    if (updateFields.length > 0) {
      const updateQuery = `
        UPDATE cajeros
        SET ${updateFields.join(', ')}
        WHERE id_cajero = $${index}
        RETURNING *;
      `;
      const result = await client.query(updateQuery, values);
      if (result.rows.length === 0) throw new Error('Cajero no encontrado');
      updatedCajero = result.rows[0];

      // Si se actualizó el nombre, también actualizar en la tabla terceros
      if (nombre !== undefined) {
        await client.query(`
          UPDATE terceros
          SET nombre = $1
          WHERE id = $2 AND tipo = 'cajero';
        `, [nombre, id]);
      }
    } else {
      const selectQuery = 'SELECT * FROM cajeros WHERE id_cajero = $1';
      const result = await client.query(selectQuery, [id]);
      if (result.rows.length === 0) throw new Error('Cajero no encontrado');
      updatedCajero = result.rows[0];
    }

    // Manejo de importes personalizados: eliminar existentes e insertar nuevos
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
          uuidv4(),
          id,
          item.producto || item.product,
          item.accion || item.action,
          item.valor || item.value,
        ]);
        await client.query(insertQuery, valuesImportes);
      }
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Cajero actualizado exitosamente',
      data: updatedCajero,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en updateCajero:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};


// 5. ELIMINAR UN CAJERO
export const deleteCajero = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // Eliminar importes personalizados relacionados (si aplica)
    await client.query('DELETE FROM importes_personalizados WHERE id_cajero = $1', [id]);

    // Eliminar de terceros
    await client.query('DELETE FROM terceros WHERE id = $1 AND tipo = $2', [id, 'cajero']);

    // Eliminar cajero
    const result = await client.query('DELETE FROM cajeros WHERE id_cajero = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Cajero no encontrado',
        details: `No se encontró un cajero con el ID: ${id}`,
      });
    }

    await client.query('COMMIT');
    res.status(200).json({
      message: 'Cajero eliminado correctamente',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en deleteCajero:', error);
    res.status(500).json({
      error: 'Error al eliminar el cajero',
      details: error.message,
    });
  } finally {
    client.release();
  }
};
