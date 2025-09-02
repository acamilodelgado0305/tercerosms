import pool from '../database.js'; // Adjust this path to your actual DB connection pool.

export const deleteWorkspaceData = async (req, res) => {
    const { workspaceId } = req.params;
    const client = await pool.connect();

    console.log(`[Finanzas] Recibida orden de limpieza para el workspace: ${workspaceId}`);

    try {
        await client.query('BEGIN');

        // Añade un DELETE por cada tabla en este servicio que tenga workspace_id
        await client.query('DELETE FROM terceros WHERE workspace_id = $1', [workspaceId]);
        await client.query('COMMIT');

        console.log(`[Finanzas] Limpieza completada para el workspace: ${workspaceId}`);
        res.status(200).json({ message: `Datos del workspace ${workspaceId} eliminados exitosamente del servicio de Terceros.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[Finanzas] Error en la limpieza para el workspace ${workspaceId}:`, error);
        res.status(500).json({ error: 'Error interno en el servicio de Terceros' });
    } finally {
        client.release();
    }
};