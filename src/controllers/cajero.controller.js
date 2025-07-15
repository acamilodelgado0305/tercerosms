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
  try {
    const query = `
      SELECT 
        c.id_cajero,
        c.nombre,
        c.responsable,
        c.municipio,
        c.direccion,
        c.comision_porcentaje,
        c.observaciones,
        c.activo,
        json_agg(
          json_build_object(
            'id_importe', ip.id_importe,
            'producto', ip.producto,
            'accion', ip.accion,
            'valor', ip.valor
          )
        ) FILTER (WHERE ip.id_importe IS NOT NULL) AS importes_personalizados
      FROM cajeros c
      LEFT JOIN importes_personalizados ip ON c.id_cajero = ip.id_cajero
      GROUP BY c.id_cajero, c.nombre, c.responsable, c.municipio, c.direccion, c.comision_porcentaje, c.observaciones, c.activo;
    `;
    const result = await pool.query(query);

    // Si no hay importes personalizados, json_agg devuelve null; lo convertimos a un arreglo vacío
    const cajeros = result.rows.map(cajero => ({
      ...cajero,
      importes_personalizados: cajero.importes_personalizados || [],
    }));

    res.status(200).json({
      message: 'Cajeros obtenidos exitosamente',
      data: cajeros,
    });
  } catch (error) {
    console.error('Error en getAllCajeros:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};

// 3. OBTENER UN CAJERO POR ID
export const getCajeroById = async (req, res) => {
  const { id } = req.params; // Obtener el ID del cajero desde los parámetros de la URL

  try {
    const query = `
      SELECT 
        c.id_cajero,
        c.nombre,
        c.responsable,
        c.municipio,
        c.direccion,
        c.comision_porcentaje,
        c.observaciones,
        c.activo,
        json_agg(
          json_build_object(
            'id_importe', ip.id_importe,
            'producto', ip.producto,
            'accion', ip.accion,
            'valor', ip.valor
          )
        ) FILTER (WHERE ip.id_importe IS NOT NULL) AS importes_personalizados
      FROM cajeros c
      LEFT JOIN importes_personalizados ip ON c.id_cajero = ip.id_cajero
      WHERE c.id_cajero = $1
      GROUP BY c.id_cajero, c.nombre, c.responsable, c.municipio, c.direccion, c.comision_porcentaje, c.observaciones, c.activo;
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cajero no encontrado',
        details: `No se encontró un cajero con el ID: ${id}`,
      });
    }

    // Asegurar que importes_personalizados sea un arreglo vacío si no hay datos
    const cajero = {
      ...result.rows[0],
      importes_personalizados: result.rows[0].importes_personalizados || [],
    };

    res.status(200).json({
      message: 'Cajero obtenido exitosamente',
      data: cajero,
    });
  } catch (error) {
    console.error('Error en getCajeroById:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
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
