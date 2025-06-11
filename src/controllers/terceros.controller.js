// src/controllers/terceros.controller.js
import pool from '../db.js'; // Asegúrate de usar 'import' si tu proyecto está en modo ES Modules

// Función auxiliar para construir el cuerpo de la query INSERT/UPDATE
// Esto ayuda a manejar un gran número de columnas de forma más limpia
const buildTerceroQueryParams = (body) => {
    const columns = [
        'tipo_tercero', 'creado_por_usuario_id', 'nombre_contacto', 'apellido_contacto',
        'contactos_direcciones', 'contacto_telefonos', 'contacto_emails', 'contacto_urls',
        'tipo_documento_identificacion', 'numero_documento_identificacion',
        'nombre_comercial_fiscal', 'numero_identificacion_fiscal', 'responsable_iva_fiscal',
        'fiscal_tipos_contribuyente', 'metodo_pago_bancaria', 'nombre_cuenta_bancaria',
        'numero_cuenta_bancaria', 'adj_cedula_url', 'adj_cedula_name', 'adj_certificado_url',
        'adj_certificado_name', 'adj_rut_name', 'adj_rut_url', 'adj_prov_camara_comercio_name',
        'adj_prov_camara_comercio_url', 'adj_prov_cert_bancario_name', 'adj_prov_cert_bancario_url',
        'roles', 'pagos_recurrentes', 'importes_fijos'
    ];

    const values = columns.map(col => {
        // Identificar los campos que son de tipo JSONB en tu tabla
        const jsonbFields = [
            'contactos_direcciones', 'contacto_telefonos', 'contacto_emails', 'contacto_urls',
            'fiscal_tipos_contribuyente', 'roles', 'pagos_recurrentes', 'importes_fijos'
        ];

        // Si el campo es un JSONB y el valor no es null/undefined, serializarlo
        if (jsonbFields.includes(col) && (body[col] !== null && typeof body[col] !== 'undefined')) {
            return JSON.stringify(body[col]);
        }
        // Para otros campos, devolver el valor tal cual
        return body[col];
    });

    return { columns, values };
};


// Obtener todos los terceros (con filtro opcional por tipo_tercero)
export const getAllTerceros = async (req, res) => {
    try {
        const { tipo_tercero } = req.query;
        let query = 'SELECT * FROM terceros';
        const params = [];

        if (tipo_tercero) {
            query += ' WHERE tipo_tercero = $1';
            params.push(tipo_tercero);
        }

        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener terceros:', error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
};

// Obtener un tercero por ID
export const getTerceroById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM terceros WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Tercero no encontrado' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener tercero por ID:', error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
};

// Crear un nuevo tercero
export const createTercero = async (req, res) => {
    try {
        const {
            tipo_tercero, nombre_contacto, numero_documento_identificacion // Campos obligatorios para validación básica
            // ... el resto de campos vienen en req.body y se mapean en buildTerceroQueryParams
        } = req.body;

        // Validación básica
        if (!tipo_tercero || !nombre_contacto || !numero_documento_identificacion) {
            return res.status(400).json({ message: 'Los campos tipo_tercero, nombre_contacto y numero_documento_identificacion son obligatorios.' });
        }

        const { columns, values } = buildTerceroQueryParams(req.body);

        // Generar placeholders ($1, $2, ...) dinámicamente
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.join(', ');

        const queryText = `
            INSERT INTO terceros (${columnNames})
            VALUES (${placeholders})
            RETURNING *;
        `;

        const result = await pool.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear tercero:', error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
};

// Actualizar un tercero
export const updateTercero = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tipo_tercero, nombre_contacto, numero_documento_identificacion // Campos obligatorios para validación básica
            // ... el resto de campos vienen en req.body y se mapean en buildTerceroQueryParams
        } = req.body;

        // Validación básica
        if (!tipo_tercero || !nombre_contacto || !numero_documento_identificacion) {
            return res.status(400).json({ message: 'Los campos tipo_tercero, nombre_contacto y numero_documento_identificacion son obligatorios.' });
        }

        const { columns, values } = buildTerceroQueryParams(req.body);

        // Generar el SET dinámicamente para la query UPDATE
        const setClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

        // Añadir fecha_actualizacion al final del SET y el ID como último parámetro
        const updateQueryText = `
            UPDATE terceros SET
                ${setClauses},
                fecha_actualizacion = NOW()
            WHERE id = $${columns.length + 1}
            RETURNING *;
        `;

        const updateValues = [...values, id]; // Añadir el ID al final de los valores

        const result = await pool.query(updateQueryText, updateValues);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Tercero no encontrado para actualizar' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar tercero:', error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
};

// Eliminar un tercero
export const deleteTercero = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM terceros WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Tercero no encontrado para eliminar' });
        }

        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Error al eliminar tercero:', error);
        res.status(500).json({ message: 'Error interno del servidor', error: error.message });
    }
};