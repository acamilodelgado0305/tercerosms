import pool from '../database.js';
import { v4 as uuidv4 } from 'uuid';

// 1. CREAR UN CAJERO
export const createCajero = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nombre, responsable, municipio, direccion, comision_porcentaje, observaciones } = req.body;

    // Validación básica
    if (!nombre || !responsable || !municipio || !direccion || comision_porcentaje === undefined) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        details: 'Los campos nombre, responsable, municipio, direccion y comision_porcentaje son obligatorios',
      });
    }

    // Validar que el porcentaje de comisión sea un número válido
    if (typeof comision_porcentaje !== 'number' || comision_porcentaje < 0 || comision_porcentaje > 100) {
      return res.status(400).json({
        error: 'Porcentaje de comisión inválido',
        details: 'El porcentaje de comisión debe ser un número entre 0 y 100',
      });
    }

    // Insertar el cajero en la base de datos
    const query = `
      INSERT INTO cajeros (
        id_cajero, nombre, responsable, municipio, direccion, comision_porcentaje, observaciones, activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      uuidv4(), // Generar UUID
      nombre,
      responsable,
      municipio,
      direccion,
      comision_porcentaje,
      observaciones || null,
      true, // Por defecto, el cajero estará activo
    ];

    const result = await client.query(query, values);
    await client.query('COMMIT');

    res.status(201).json({
      message: 'Cajero creado exitosamente',
      data: result.rows[0],
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
    const query = 'SELECT * FROM cajeros';
    const result = await pool.query(query);

    res.status(200).json({
      message: 'Cajeros obtenidos exitosamente',
      data: result.rows,
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
    const query = 'SELECT * FROM cajeros WHERE id_cajero = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Cajero no encontrado',
        details: `No se encontró un cajero con el ID: ${id}`,
      });
    }

    res.status(200).json({
      message: 'Cajero obtenido exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error en getCajeroById:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};

// 4. ACTUALIZAR UN CAJERO
export const updateCajero = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params; // Obtener el ID del cajero desde los parámetros de la URL
    const { nombre, responsable, municipio, direccion, comision_porcentaje, observaciones, activo } = req.body;

    // Validar que al menos un campo esté presente para actualizar
    if (
      !nombre &&
      !responsable &&
      !municipio &&
      !direccion &&
      comision_porcentaje === undefined &&
      observaciones === undefined &&
      activo === undefined
    ) {
      return res.status(400).json({
        error: 'Ningún campo proporcionado para actualizar',
        details: 'Debes proporcionar al menos un campo para actualizar',
      });
    }

    // Construir la consulta dinámicamente solo con los campos proporcionados
    let updateFields = [];
    let values = [];
    let parameterIndex = 1;

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
        updateFields.push(`${field} = $${parameterIndex}`);
        values.push(value);
        parameterIndex++;
      }
    }

    values.push(id); // Agregar el ID al final de los valores

    const query = `
      UPDATE cajeros
      SET ${updateFields.join(', ')}
      WHERE id_cajero = $${parameterIndex}
      RETURNING *;
    `;

    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      res.status(200).json({
        message: 'Cajero actualizado exitosamente',
        data: result.rows[0],
      });
    } else {
      throw new Error('Error al actualizar el cajero');
    }
  } catch (error) {
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
  const { id } = req.params; // Obtener el ID del cajero desde los parámetros de la URL
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar si el cajero existe
    const query = 'DELETE FROM cajeros WHERE id_cajero = $1 RETURNING *';
    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Cajero no encontrado',
        details: `No se encontró un cajero con el ID: ${id}`,
      });
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Cajero eliminado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en deleteCajero:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};