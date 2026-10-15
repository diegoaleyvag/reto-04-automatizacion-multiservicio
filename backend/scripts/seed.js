import { postgres, mariadb, closeDatabases } from '../src/db.js';

try {
  const products = [['TEC-001', 'Teclado mecánico', 24], ['MON-002', 'Monitor de 24 pulgadas', 12], ['USB-003', 'Memoria USB de 64 GB', 48]];
  const tasks = [['Revisar el inventario de la semana', false, 'inventario'], ['Preparar el respaldo de las bases', false, 'respaldo'], ['Comprobar los cuatro servicios', true, 'servicios']];
  for (const product of products) await mariadb.execute('INSERT IGNORE INTO products (code, name, stock) VALUES (?, ?, ?)', product);
  for (const task of tasks) await postgres.query('INSERT INTO tasks (title, completed, seed_key) VALUES ($1, $2, $3) ON CONFLICT (seed_key) DO NOTHING', task);
  console.log('Sembrado completado. Los registros existentes se conservaron.');
} catch (error) {
  console.error('No se pudo completar el sembrado:', error.code || 'SIN_CODIGO');
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
