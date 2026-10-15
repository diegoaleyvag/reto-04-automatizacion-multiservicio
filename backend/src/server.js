import http from 'node:http';
import { postgres, mariadb, closeDatabases } from './db.js';

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size <= 16384) chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      if (size > 16384) return reject(new HttpError(400, 'La solicitud supera el tamaño permitido de 16 KiB.'));
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        return reject(new HttpError(400, 'Envía los datos en formato JSON.'));
      }
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        resolve(body);
      } catch {
        reject(new HttpError(400, 'El cuerpo debe ser un objeto JSON válido.'));
      }
    });
  });
}

function validateProduct(body, creating) {
  const fields = {};
  const values = {};
  if (creating) {
    if (typeof body.code !== 'string' || !/^[A-Z0-9-]{2,32}$/.test(body.code)) {
      fields.code = 'Usa entre 2 y 32 letras mayúsculas, números o guiones.';
    } else values.code = body.code;
  }
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
    fields.name = 'Escribe un nombre de entre 2 y 100 caracteres.';
  } else values.name = body.name.trim();
  if (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 1000000) {
    fields.stock = 'La cantidad debe ser un entero entre 0 y 1000000.';
  } else values.stock = body.stock;
  if (Object.keys(fields).length) throw new HttpError(400, 'Revisa los campos indicados.', fields);
  return values;
}

function validateId(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) {
    throw new HttpError(400, 'El identificador debe ser un entero positivo válido.');
  }
  return Number(value);
}

function taskView(row) {
  return { id: row.id, title: row.title, completed: row.completed, createdAt: row.created_at };
}

async function health(response) {
  const checks = await Promise.allSettled([
    postgres.query('SELECT 1'),
    mariadb.query({ sql: 'SELECT 1', timeout: 5000 })
  ]);
  const ok = checks.every((result) => result.status === 'fulfilled');
  send(response, ok ? 200 : 503, {
    status: ok ? 'ok' : 'error',
    services: {
      postgres: { status: checks[0].status === 'fulfilled' ? 'ok' : 'error' },
      mariadb: { status: checks[1].status === 'fulfilled' ? 'ok' : 'error' },
      backend: { status: 'ok' }
    }
  });
}

async function products(request, response, idText) {
  if (!idText && request.method === 'GET') {
    const [rows] = await mariadb.execute('SELECT id, code, name, stock FROM products ORDER BY id');
    return send(response, 200, { products: rows });
  }
  if (!idText && request.method === 'POST') {
    const body = validateProduct(await readBody(request), true);
    const [result] = await mariadb.execute('INSERT INTO products (code, name, stock) VALUES (?, ?, ?)', [body.code, body.name, body.stock]);
    return send(response, 201, { product: { id: result.insertId, ...body } });
  }
  if (idText && ['PATCH', 'DELETE'].includes(request.method)) {
    const id = validateId(idText);
    if (request.method === 'PATCH') {
      const body = validateProduct(await readBody(request), false);
      const [result] = await mariadb.execute('UPDATE products SET name = ?, stock = ? WHERE id = ?', [body.name, body.stock, id]);
      if (!result.affectedRows) throw new HttpError(404, 'No encontramos el producto. Actualiza la lista e inténtalo de nuevo.');
      const [rows] = await mariadb.execute('SELECT id, code, name, stock FROM products WHERE id = ?', [id]);
      return send(response, 200, { product: rows[0] });
    }
    const [result] = await mariadb.execute('DELETE FROM products WHERE id = ?', [id]);
    if (!result.affectedRows) throw new HttpError(404, 'No encontramos el producto que deseas eliminar.');
    return send(response, 200, { message: 'Producto eliminado correctamente.' });
  }
  throw new HttpError(404, 'La ruta solicitada no existe.');
}

async function tasks(request, response, idText) {
  if (!idText && request.method === 'GET') {
    const result = await postgres.query('SELECT id, title, completed, created_at FROM tasks ORDER BY id');
    return send(response, 200, { tasks: result.rows.map(taskView) });
  }
  if (!idText && request.method === 'POST') {
    const body = await readBody(request);
    if (typeof body.title !== 'string' || body.title.includes('\0') || body.title.trim().length < 2 || body.title.trim().length > 160) {
      throw new HttpError(400, 'Revisa el título de la tarea.', { title: 'Escribe entre 2 y 160 caracteres.' });
    }
    const result = await postgres.query('INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed, created_at', [body.title.trim()]);
    return send(response, 201, { task: taskView(result.rows[0]) });
  }
  if (idText && ['PATCH', 'DELETE'].includes(request.method)) {
    const id = validateId(idText);
    if (request.method === 'PATCH') {
      const body = await readBody(request);
      if (typeof body.completed !== 'boolean') throw new HttpError(400, 'Indica un estado válido.', { completed: 'El estado debe ser verdadero o falso.' });
      const result = await postgres.query('UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING id, title, completed, created_at', [body.completed, id]);
      if (!result.rowCount) throw new HttpError(404, 'No encontramos la tarea. Actualiza la lista e inténtalo de nuevo.');
      return send(response, 200, { task: taskView(result.rows[0]) });
    }
    const result = await postgres.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (!result.rowCount) throw new HttpError(404, 'No encontramos la tarea que deseas eliminar.');
    return send(response, 200, { message: 'Tarea eliminada correctamente.' });
  }
  throw new HttpError(404, 'La ruta solicitada no existe.');
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/health' && request.method === 'GET') return await health(response);
    const route = pathname.match(/^\/api\/(products|tasks)(?:\/([^/]+))?\/?$/);
    if (!route) throw new HttpError(404, 'La ruta solicitada no existe.');
    if (route[1] === 'products') return await products(request, response, route[2]);
    return await tasks(request, response, route[2]);
  } catch (error) {
    if (error instanceof HttpError) return send(response, error.status, { message: error.message, ...(error.fields ? { fields: error.fields } : {}) });
    if (error.code === 'ER_DUP_ENTRY') return send(response, 409, { message: 'Ya existe un producto con este código.', fields: { code: 'Usa un código diferente.' } });
    console.error('Error de operación:', error.code || 'SIN_CODIGO');
    const unavailable = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', '57P01', '57P03', 'PROTOCOL_CONNECTION_LOST'].includes(error.code);
    send(response, unavailable ? 503 : 500, { message: unavailable ? 'Una base de datos no está disponible. Espera un momento y vuelve a intentar.' : 'No pudimos completar la operación. Vuelve a intentarlo.' });
  }
});

server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(3000, '0.0.0.0', () => console.log('Servidor disponible en el puerto 3000.'));

async function shutdown() {
  server.close(async () => {
    await closeDatabases();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
