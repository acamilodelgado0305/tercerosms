import { v4 as uuidv4 } from 'uuid';
import pool from '../database.js';
import { providerSchema } from '../schemas/providerSchema.js';

export const createProvider = async (req, res) => {
  try {
    // Si el tipo de identificación es CC y nombreComercial está vacío, eliminamos nombreComercial
    if (req.body.tipoIdentificacion === 'CC' && !req.body.nombreComercial) {
      delete req.body.nombreComercial;
    }

    // Validar los datos con Joi
    const { error } = providerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details,
      });
    }

    // Extraer los datos de la solicitud
    const {
      tipoIdentificacion,
      numeroIdentificacion,
      nombreComercial,
      nombresContacto,
      apellidosContacto,
      pais,
      tipo,
      ciudad,
      direccion,
      departamento,
      telefono,
      correo,
      otrosDocumentos,
      camaraComercio,
      rut,
      sitioweb,
      medioPago,
      estado,
      fechaVencimiento,
      certificadoBancario,
      responsableIva,
      responsabilidadFiscal,

    } = req.body;

    // Asegurarse de que 'telefono' y 'correo' sean arrays antes de hacer .map()
    const telefonoJSON = Array.isArray(telefono) ? JSON.stringify(telefono) : JSON.stringify([]);
    const correoJSON = Array.isArray(correo) ? JSON.stringify(correo) : JSON.stringify([]);
    const responsabilidadFiscalJSON = Array.isArray(responsabilidadFiscal) ? JSON.stringify(responsabilidadFiscal) : JSON.stringify([]);

    // Si el tipo de identificación es NIT, el nombre no es obligatorio
    if (tipoIdentificacion === 'NIT' && !nombreComercial) {
      console.log("Advertencia: El campo 'nombreComercial' no es obligatorio para NIT.");
    }

    // Asignar nombresContacto como nombreComercial si nombreComercial está vacío
    const nombreComercialFinal = nombreComercial || nombresContacto || '';

    // Generar un único ID para ambas tablas
    const providerId = uuidv4();

    // Iniciar la transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar el proveedor
      const proveedorQuery = `
        INSERT INTO proveedores (
          id,
          tipo_identificacion,
          numero_identificacion,
          nombre_comercial,
          nombres_contacto,
          apellidos_contacto,
          pais,
          tipo,
          direccion,
          departamento,
          ciudad,
          telefono,
          correo,
          otros_documentos,
          camara_comercio,  
          rut,
          medio_pago,
          sitioweb,
          estado,
          fecha_vencimiento,
          certificado_bancario,
          responsable_iva,
          responsabilidad_fiscal
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20 ,$21 , $22 , $23)
        RETURNING *`;

      const proveedorValues = [
        providerId,
        tipoIdentificacion,
        numeroIdentificacion,
        nombreComercialFinal,
        nombresContacto,
        apellidosContacto,
        pais,
        tipo,
        direccion,
        departamento,
        ciudad,
        telefonoJSON,
        correoJSON,
        otrosDocumentos || null,
        camaraComercio || null,
        rut || null,
        medioPago || 'Otro',
        sitioweb || null,
        estado || 'activo',
        fechaVencimiento || null,
        certificadoBancario || null,
        responsableIva || 'no',
        responsabilidadFiscalJSON || null,
      ];

      // Ejecutar la consulta para insertar el proveedor
      const proveedorResult = await client.query(proveedorQuery, proveedorValues);

      // Insertar en la tabla terceros con el mismo ID
      const terceroQuery = `
        INSERT INTO terceros (id, nombre, tipo)
        VALUES ($1, $2, $3)
        RETURNING *`;

      const terceroValues = [providerId, nombreComercialFinal || 'No disponible', 'proveedor'];
      await client.query(terceroQuery, terceroValues);

      // Confirmar la transacción
      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Proveedor creado exitosamente',
        data: proveedorResult.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al crear el proveedor:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};


// Obtener todos los proveedores
export const getAllProviders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores');
    res.json(result.rows);  // Se devolverán los proveedores con todos los campos, incluyendo los nuevos
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los proveedores' });
  }
};
// Obtener un proveedor por ID
export const getProviderById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el proveedor' });
  }
};

// Actualizar un proveedor
export const updateProvider = async (req, res) => {
  const { id } = req.params;
  const {
    tipoIdentificacion,
    numeroIdentificacion,
    nombreComercial,
    nombresContacto,
    apellidosContacto,
    ciudad,
    direccion,
    pais,
    tipo,
    departamento,
    telefono,
    correo,
    sitioweb,
    medioPago,
    estado,
    certificadoBancario,
    fechaVencimiento,
    camaraComercio,
    rut,
    otrosDocumentos,
    responsableIva,
    responsabilidadFiscal,


  } = req.body;

  try {
    // Si el tipo de identificación es CC y nombreComercial está vacío, eliminamos nombreComercial
    if (tipoIdentificacion === 'CC' && !nombreComercial) {
      delete req.body.nombreComercial;
    }

    // Validar los datos con Joi
    const { error } = providerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details,
      });
    }

    // Asegurarse de que 'telefono' y 'correo' sean arrays antes de hacer .map()
    const telefonoJSON = Array.isArray(telefono) ? JSON.stringify(telefono) : JSON.stringify([]);
    const correoJSON = Array.isArray(correo) ? JSON.stringify(correo) : JSON.stringify([]);
    const responsabilidadFiscalJSON = Array.isArray(responsabilidadFiscal) ? JSON.stringify(responsabilidadFiscal) : JSON.stringify([]);

    // Iniciar la transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Actualizar el proveedor
      const proveedorQuery = `
        UPDATE proveedores
        SET tipo_identificacion = $1,
            numero_identificacion = $2,
            nombre_comercial = $3,
            nombres_contacto = $4,
            apellidos_contacto = $5,
            direccion = $6,
            departamento = $7,
            ciudad = $8,
            telefono = $9,
            correo = $10,
            medio_pago = $11,
            sitioweb = $12,
            estado = $13,
            fecha_vencimiento = $14,
            pais = $15,
            tipo = $16,
            certificado_bancario = $17,
            camara_comercio = $18,  
            rut = $19,
            otros_documentos = $20,
            responsable_iva = $21,
            responsabilidad_fiscal = $22
        WHERE id = $23
        RETURNING *`;

      const proveedorValues = [
        tipoIdentificacion,
        numeroIdentificacion,
        nombreComercial || '',  // Si no se proporciona, dejar vacío
        nombresContacto,
        apellidosContacto,
        direccion,
        departamento,
        ciudad,
        telefonoJSON,
        correoJSON,
        medioPago || 'Otro',
        sitioweb || null,
        estado || 'activo',
        fechaVencimiento || null,
        pais,
        tipo || 'No disponible', // Si no se proporciona, asignar valor predeterminado
        certificadoBancario || null,
        camaraComercio || null,
        rut || null,
        otrosDocumentos || null,
        responsableIva || 'no',
        responsabilidadFiscalJSON || null,
        id, // ID del proveedor
      ];

      const result = await client.query(proveedorQuery, proveedorValues);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Proveedor no encontrado',
          details: `No se encontró ningún proveedor con el ID ${id}`,
        });
      }

      // Confirmar la transacción
      await client.query('COMMIT');

      res.status(200).json({
        status: 'success',
        message: 'Proveedor actualizado exitosamente',
        data: result.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en updateProvider:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflicto',
        details: 'Ya existe un proveedor con estos datos únicos',
      });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
};


// Eliminar un proveedor
export const deleteProvider = async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    // Iniciar la transacción
    await client.query('BEGIN');

    // Verificar si el proveedor existe
    const proveedorResult = await client.query('SELECT * FROM proveedores WHERE id = $1', [id]);
    if (proveedorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Proveedor no encontrado',
        details: `No se encontró ningún proveedor con el ID ${id}`,
      });
    }

    // Eliminar de la tabla terceros
    const terceroResult = await client.query('DELETE FROM terceros WHERE id = $1 AND tipo = $2 RETURNING *', [id, 'proveedor']);
    if (terceroResult.rows.length === 0) {
      console.warn(`No se encontró un registro en terceros para el proveedor con ID ${id}`);
    }

    // Eliminar de la tabla proveedores
    const proveedorDeleteResult = await client.query('DELETE FROM proveedores WHERE id = $1 RETURNING *', [id]);

    // Confirmar la transacción
    await client.query('COMMIT');

    res.status(200).json({
      status: 'success',
      message: 'Proveedor eliminado exitosamente',
      data: proveedorDeleteResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en deleteProvider:', error);
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Conflicto de dependencia',
        details: 'Este proveedor no puede ser eliminado porque está referenciado en otras tablas',
      });
    }
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  } finally {
    client.release();
  }
};

