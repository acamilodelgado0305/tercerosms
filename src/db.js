import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Configuración para que pg no convierta automáticamente los tipos de datos timestamp
const types = pkg.types;
// Sobrescribir el parser de timestamp para evitar la conversión a UTC
types.setTypeParser(1114, str => str); // 1114 es el OID para TIMESTAMP sin timezone

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  timezone: 'America/Bogota'
});

// Configurar la zona horaria al conectar
pool.on('connect', async (client) => {
  try {
    await client.query("SET TIME ZONE 'America/Bogota';");
    console.log('Conectado a la base de datos PostgreSQL con zona horaria America/Bogota');
  } catch (err) {
    console.error('Error al configurar la zona horaria:', err);
  }
});

pool.on('error', (err) => {
  console.error('Error en la conexión con PostgreSQL', err);
  process.exit(-1);
});

// Función para probar la conexión y verificar la zona horaria
const testConnection = async () => {
  try {
    const result = await pool.query("SELECT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') as current_time");
    console.log('Conexión exitosa a la base de datos PostgreSQL');
    console.log('Hora actual en la base de datos:', result.rows[0].current_time);
  } catch (err) {
    console.error('Error probando la conexión con PostgreSQL', err);
  }
};

testConnection();

export default pool;