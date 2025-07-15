export const manageAttachments = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;  // Obtener el id del proveedor desde los parámetros de la URL

        if (!id) {
            return res.status(400).json({ error: 'Campo id es obligatorio' });
        }

        // Obtener los archivos subidos
        const uploadedFiles = req.files || [];

        if (uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'No se subieron archivos' });
        }

        // Obtener los archivos adjuntos actuales del proveedor
        const getCurrentAttachmentsQuery = 'SELECT adjuntos FROM proveedores WHERE id = $1';
        const currentResult = await client.query(getCurrentAttachmentsQuery, [id]);

        if (currentResult.rows.length === 0) {
            return res.status(400).json({ error: 'Proveedor no encontrado' });
        }

        let currentAttachments = currentResult.rows[0].adjuntos || [];
        let updatedAttachments = [...currentAttachments];

        // Agregar los nuevos archivos a los existentes
        updatedAttachments = [
            ...currentAttachments,
            ...uploadedFiles.map(file => ({
                tipo: file.fieldname,  // Puedes asociar el tipo del archivo, como Cámara de Comercio, RUT, etc.
                archivo: file.path,    // Guardar la ruta del archivo
            }))
        ];

        // Convertir los archivos adjuntos a un formato adecuado para PostgreSQL
        const processedAttachments = '{' + updatedAttachments
            .filter(v => v.archivo.trim())
            .map(v => `"${v.archivo.replace(/"/g, '\\"')}"`)
            .join(',') + '}';

        // Actualizar los adjuntos en la base de datos
        const updateQuery = 'UPDATE proveedores SET adjuntos = $1::jsonb WHERE id = $2 RETURNING *';
        const result = await client.query(updateQuery, [processedAttachments, id]);

        res.status(200).json({
            message: 'Archivos adjuntos actualizados correctamente',
            data: result.rows[0],
        });

    } catch (error) {
        console.error('Error en manageAttachments:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
};
