import { createHash } from 'node:crypto';
import { postgres, mariadb, closeDatabases } from '../src/db.js';

function signature(rows) {
  return { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
}

try {
  const pgResult = await postgres.query('SELECT id, title, completed, seed_key, created_at FROM tasks ORDER BY id');
  const [myRows] = await mariadb.query('SELECT id, code, name, stock FROM products ORDER BY id');
  console.log(JSON.stringify({ postgres: signature(pgResult.rows), mariadb: signature(myRows) }));
} catch (error) {
  console.error('No se pudo verificar el contenido de las bases:', error.code || 'SIN_CODIGO');
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
