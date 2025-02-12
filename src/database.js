import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT, 
});

pool.on('connect', () => {
  console.log('Conectado a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Error en la conexión con PostgreSQL', err);
  process.exit(-1);
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Conexión exitosa a la base de datos PostgreSQL');
  } catch (err) {
    console.error('Error probando la conexión con PostgreSQL', err);
  }
};

testConnection();

export default pool;
