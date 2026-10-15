import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { postgres, mariadb, closeDatabases } from '../src/db.js';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const prefix = `PRUEBA-${randomBytes(5).toString('hex').toUpperCase()}`;
const productIds = [];
const taskIds = [];
let sequence = 0;

async function request(path, method = 'GET', body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000)
  });
  assert.match(response.headers.get('content-type'), /application\/json/);
  return { status: response.status, body: await response.json() };
}

async function createProduct(overrides = {}) {
  const payload = { code: `${prefix}-${++sequence}`, name: 'Producto de prueba', stock: 5, ...overrides };
  const result = await request('/api/products', 'POST', payload);
  assert.equal(result.status, 201);
  productIds.push(result.body.product.id);
  return result.body.product;
}

async function createTask(title = `${prefix} tarea ${++sequence}`) {
  const result = await request('/api/tasks', 'POST', { title });
  assert.equal(result.status, 201);
  taskIds.push(result.body.task.id);
  return result.body.task;
}

before(async () => {
  assert.equal((await request('/api/health')).status, 200);
});

after(async () => {
  try {
    for (const id of productIds) await mariadb.execute('DELETE FROM products WHERE id = ?', [id]);
    for (const id of taskIds) await postgres.query('DELETE FROM tasks WHERE id = $1', [id]);
  } finally {
    await closeDatabases();
  }
});

test('La salud consulta PostgreSQL y MariaDB reales', async () => {
  const result = await request('/api/health');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'ok', services: { postgres: { status: 'ok' }, mariadb: { status: 'ok' }, backend: { status: 'ok' } } });
});

test('El listado de productos devuelve una colección', async () => {
  const result = await request('/api/products');
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.products));
});

test('Crear producto persiste exactamente sus datos en MariaDB', async () => {
  const product = await createProduct({ name: 'Ratón ergonómico', stock: 7 });
  const [rows] = await mariadb.execute('SELECT id, code, name, stock FROM products WHERE id = ?', [product.id]);
  assert.deepEqual(rows[0], product);
});

test('Editar producto conserva su código y actualiza la cantidad', async () => {
  const product = await createProduct();
  const result = await request(`/api/products/${product.id}`, 'PATCH', { name: 'Producto editado', stock: 0 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.product, { ...product, name: 'Producto editado', stock: 0 });
});

test('Editar sin cambiar valores sigue devolviendo el producto', async () => {
  const product = await createProduct();
  const result = await request(`/api/products/${product.id}`, 'PATCH', { name: product.name, stock: product.stock });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.product, product);
});

test('Eliminar producto lo retira del motor y repetir devuelve 404', async () => {
  const product = await createProduct();
  assert.equal((await request(`/api/products/${product.id}`, 'DELETE')).status, 200);
  const [rows] = await mariadb.execute('SELECT id FROM products WHERE id = ?', [product.id]);
  assert.equal(rows.length, 0);
  assert.equal((await request(`/api/products/${product.id}`, 'DELETE')).status, 404);
});

test('Un código duplicado produce 409 y un mensaje amigable', async () => {
  const product = await createProduct();
  const result = await request('/api/products', 'POST', { code: product.code, name: 'Duplicado', stock: 1 });
  assert.equal(result.status, 409);
  assert.equal(typeof result.body.fields.code, 'string');
  assert.ok(!JSON.stringify(result.body).includes('INSERT'));
});

test('Un producto con código inválido produce 400', async () => {
  const result = await request('/api/products', 'POST', { code: "X'; DROP TABLE products;--", name: 'Prueba', stock: 1 });
  assert.equal(result.status, 400);
  assert.ok(result.body.fields.code);
});

for (const stock of [-1, 1.5, '5', null, 1000001]) {
  test(`El servidor rechaza la cantidad inválida ${JSON.stringify(stock)}`, async () => {
    const result = await request('/api/products', 'POST', { code: `${prefix}-${++sequence}`, name: 'Prueba', stock });
    assert.equal(result.status, 400);
    assert.ok(result.body.fields.stock);
  });
}

test('Se aceptan los extremos válidos de cantidad', async () => {
  assert.equal((await createProduct({ stock: 0 })).stock, 0);
  assert.equal((await createProduct({ stock: 1000000 })).stock, 1000000);
});

test('El nombre vacío y un nombre excesivo se rechazan', async () => {
  for (const name of [' ', 'a'.repeat(101)]) {
    const result = await request('/api/products', 'POST', { code: `${prefix}-${++sequence}`, name, stock: 1 });
    assert.equal(result.status, 400);
    assert.ok(result.body.fields.name);
  }
});

test('Editar un producto inexistente devuelve 404', async () => {
  assert.equal((await request('/api/products/2147483647', 'PATCH', { name: 'Prueba', stock: 1 })).status, 404);
});

test('El listado de tareas devuelve fechas y estados válidos', async () => {
  await createTask();
  const result = await request('/api/tasks');
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.tasks));
  for (const task of result.body.tasks) {
    assert.equal(typeof task.completed, 'boolean');
    assert.ok(Number.isFinite(Date.parse(task.createdAt)));
  }
});

test('Crear tarea persiste los datos reales en PostgreSQL', async () => {
  const task = await createTask();
  assert.equal(task.completed, false);
  const result = await postgres.query('SELECT title, completed FROM tasks WHERE id = $1', [task.id]);
  assert.deepEqual(result.rows[0], { title: task.title, completed: false });
});

test('Una tarea puede completarse y volver a estar pendiente', async () => {
  const task = await createTask();
  for (const completed of [true, false]) {
    const result = await request(`/api/tasks/${task.id}`, 'PATCH', { completed });
    assert.equal(result.status, 200);
    assert.equal(result.body.task.completed, completed);
  }
});

test('Eliminar tarea la retira de PostgreSQL y repetir devuelve 404', async () => {
  const task = await createTask();
  assert.equal((await request(`/api/tasks/${task.id}`, 'DELETE')).status, 200);
  assert.equal((await postgres.query('SELECT id FROM tasks WHERE id = $1', [task.id])).rowCount, 0);
  assert.equal((await request(`/api/tasks/${task.id}`, 'DELETE')).status, 404);
});

test('Los títulos vacíos o demasiado largos producen 400', async () => {
  for (const title of ['', ' ', 'a'.repeat(161), 'Tarea\0inválida', 42, null]) {
    const result = await request('/api/tasks', 'POST', { title });
    assert.equal(result.status, 400);
    assert.ok(result.body.fields.title);
  }
});

test('El estado de tarea exige un booleano JSON', async () => {
  const task = await createTask();
  for (const completed of ['true', 1, null]) {
    const result = await request(`/api/tasks/${task.id}`, 'PATCH', { completed });
    assert.equal(result.status, 400);
    assert.ok(result.body.fields.completed);
  }
});

test('Editar una tarea inexistente devuelve 404', async () => {
  assert.equal((await request('/api/tasks/2147483647', 'PATCH', { completed: true })).status, 404);
});

test('Las consultas parametrizadas conservan textos con sintaxis SQL', async () => {
  const title = `${prefix} '; DROP TABLE tasks; --`;
  const task = await createTask(title);
  assert.equal(task.title, title);
  const product = await createProduct({ name: "O'Reilly; DROP TABLE products;" });
  assert.equal(product.name, "O'Reilly; DROP TABLE products;");
  assert.equal((await request('/api/tasks')).status, 200);
  assert.equal((await request('/api/products')).status, 200);
});

test('Los identificadores inválidos no llegan a las consultas', async () => {
  for (const id of ['0', '-1', '1.5', '1%20OR%201=1', '99999999999999999999']) {
    assert.equal((await request(`/api/products/${id}`, 'DELETE')).status, 400);
    assert.equal((await request(`/api/tasks/${id}`, 'DELETE')).status, 400);
  }
});

test('El cuerpo JSON mal formado recibe 400 sin exponer detalles', async () => {
  const result = await request('/api/tasks', 'POST', '{"title":');
  assert.equal(result.status, 400);
  assert.equal(typeof result.body.message, 'string');
  assert.ok(!result.body.stack);
});

test('Los cuerpos que no sean objetos JSON se rechazan', async () => {
  for (const body of ['null', '[]', '42']) assert.equal((await request('/api/tasks', 'POST', body)).status, 400);
});

test('Se exige el tipo de contenido JSON', async () => {
  assert.equal((await request('/api/tasks', 'POST', 'title=prueba', { 'Content-Type': 'text/plain' })).status, 400);
});

test('Una solicitud mayor que 16 KiB recibe un error controlado', async () => {
  assert.equal((await request('/api/tasks', 'POST', { title: 'a'.repeat(17000) })).status, 400);
});

test('Las rutas desconocidas y los métodos no admitidos reciben 404', async () => {
  assert.equal((await request('/api/no-existe')).status, 404);
  assert.equal((await request('/api/tasks', 'PUT', {})).status, 404);
});
