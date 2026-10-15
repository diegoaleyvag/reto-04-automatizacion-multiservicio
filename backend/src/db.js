import mysql from 'mysql2/promise';
import pg from 'pg';

export const postgres = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: 5432,
  user: process.env.POSTGRES_USER || 'aplicacion',
  password: process.env.POSTGRES_PASSWORD || 'postgres_local_04',
  database: process.env.POSTGRES_DB || 'operaciones',
  max: 8,
  connectionTimeoutMillis: 4000,
  statement_timeout: 5000
});

export const mariadb = mysql.createPool({
  host: process.env.MARIADB_HOST || 'mariadb',
  port: 3306,
  user: process.env.MARIADB_USER || 'aplicacion',
  password: process.env.MARIADB_PASSWORD || 'mariadb_local_04',
  database: process.env.MARIADB_DATABASE || 'inventario',
  connectionLimit: 8,
  connectTimeout: 4000,
  decimalNumbers: true
});

postgres.on('error', (error) => console.error('Conexión PostgreSQL interrumpida:', error.code || 'SIN_CODIGO'));

export async function closeDatabases() {
  await Promise.all([postgres.end(), mariadb.end()]);
}
