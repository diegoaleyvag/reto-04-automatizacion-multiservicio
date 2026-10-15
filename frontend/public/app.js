const productList = document.querySelector('#products-list');
const taskList = document.querySelector('#tasks-list');
const productForm = document.querySelector('#product-form');
const taskForm = document.querySelector('#task-form');
const healthButton = document.querySelector('#refresh-health');
let products = [];
let tasks = [];
let healthRunning = false;

class RequestError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: controller.signal,
      cache: 'no-store'
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new RequestError(data?.message || 'No se pudo completar la solicitud. Revisa el estado de los servicios e inténtalo de nuevo.', response.status, data?.fields);
    }
    if (!data) throw new RequestError('El servidor envió una respuesta que no se pudo leer. Inténtalo de nuevo.', response.status);
    return data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (error.name === 'AbortError') throw new RequestError('La solicitud tardó demasiado. Revisa la conexión e inténtalo de nuevo.', 0);
    throw new RequestError('No pudimos conectar con el servicio. Comprueba que el entorno esté iniciado e inténtalo de nuevo.', 0);
  } finally {
    clearTimeout(timer);
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}

function notify(message, tone = 'success') {
  const feedback = document.querySelector('#feedback');
  feedback.dataset.tone = tone;
  feedback.textContent = message;
  feedback.hidden = false;
}

function showFormError(form, target, message, fields) {
  target.textContent = message;
  target.hidden = false;
  if (fields && typeof fields === 'object') {
    for (const name of Object.keys(fields)) {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) input.setAttribute('aria-invalid', 'true');
    }
  }
}

function clearFormError(form, target) {
  target.textContent = '';
  target.hidden = true;
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
}

function setPending(form, pending) {
  form.setAttribute('aria-busy', String(pending));
  for (const control of form.querySelectorAll('button, input')) control.disabled = pending;
}

function lockSection(type, locked) {
  const form = type === 'products' ? productForm : taskForm;
  const list = type === 'products' ? productList : taskList;
  setPending(form, locked);
  for (const control of list.querySelectorAll('button, input')) control.disabled = locked;
}

function setService(name, state) {
  document.querySelector(`#dot-${name}`).dataset.state = state;
  const status = document.querySelector(`#status-${name}`);
  status.dataset.state = state;
  status.textContent = state === 'ok' ? 'Disponible' : state === 'error' ? 'Sin conexión' : 'Comprobando…';
}

async function checkHealth() {
  if (healthRunning) return;
  healthRunning = true;
  healthButton.disabled = true;
  healthButton.setAttribute('aria-busy', 'true');
  let frontendOk = false;
  let backendOk = false;
  await Promise.allSettled([
    request('/salud').then(data => {
      frontendOk = data.status === 'ok';
      setService('frontend', frontendOk ? 'ok' : 'error');
    }).catch(() => setService('frontend', 'error')),
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/health', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        const validHealth = [200, 503].includes(response.status) && data.services;
        backendOk = Boolean(validHealth && data.services.backend?.status === 'ok');
        setService('backend', backendOk ? 'ok' : 'error');
        for (const name of ['postgres', 'mariadb']) setService(name, validHealth && data.services[name]?.status === 'ok' ? 'ok' : 'error');
      } catch {
        for (const name of ['backend', 'postgres', 'mariadb']) setService(name, 'error');
      } finally {
        clearTimeout(timer);
      }
    })()
  ]);
  const allOk = [...document.querySelectorAll('.status-dot')].every(dot => dot.dataset.state === 'ok');
  const checkedAt = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  document.querySelector('#health-note').textContent = allOk ? `Los cuatro servicios responden correctamente. Última comprobación: ${checkedAt}.` : `Hay servicios sin conexión. Ejecuta «make iniciar» en la terminal y vuelve a comprobar. Última comprobación: ${checkedAt}.`;
  healthButton.disabled = false;
  healthButton.removeAttribute('aria-busy');
  healthRunning = false;
  return frontendOk && backendOk;
}

function showListError(container, error, retry) {
  const state = element('div', 'error-state');
  state.append(element('p', '', error.message), button('Volver a intentar', 'button button--secondary', retry));
  container.replaceChildren(state);
}

function emptyState(heading, description) {
  const state = element('div', 'empty-state');
  state.append(element('strong', '', heading), element('span', '', description));
  return state;
}

function field(labelText, name, value, options = {}) {
  const wrapper = element('div', 'field');
  const label = element('label', '', labelText);
  const input = element('input');
  input.id = options.id;
  input.name = name;
  input.value = value;
  input.required = true;
  input.type = options.type || 'text';
  if (options.min !== undefined) input.min = options.min;
  if (options.max !== undefined) input.max = options.max;
  if (options.maxLength !== undefined) input.maxLength = options.maxLength;
  if (options.minLength !== undefined) input.minLength = options.minLength;
  if (options.type === 'number') {
    input.step = '1';
    input.inputMode = 'numeric';
  }
  label.htmlFor = input.id;
  wrapper.append(label, input);
  return wrapper;
}

function validateProduct(form, errorTarget, includeCode) {
  const name = form.elements.namedItem('name');
  const stock = form.elements.namedItem('stock');
  const trimmedName = name.value.trim();
  if (includeCode) {
    const code = form.elements.namedItem('code');
    code.value = code.value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,32}$/.test(code.value)) {
      showFormError(form, errorTarget, 'Escribe un código de 2 a 32 caracteres, con letras, números o guiones.', { code: true });
      code.focus();
      return null;
    }
  }
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    showFormError(form, errorTarget, 'El nombre debe tener entre 2 y 100 caracteres.', { name: true });
    name.focus();
    return null;
  }
  const stockValue = Number(stock.value);
  if (!stock.value.trim() || !Number.isInteger(stockValue) || stockValue < 0 || stockValue > 1000000) {
    showFormError(form, errorTarget, 'La cantidad debe ser un número entero entre 0 y 1.000.000.', { stock: true });
    stock.focus();
    return null;
  }
  return { ...(includeCode ? { code: form.elements.namedItem('code').value } : {}), name: trimmedName, stock: stockValue };
}

function addDeleteConfirmation(item, trigger, label, onDelete) {
  if (item.querySelector('.delete-confirm')) return;
  const type = item.classList.contains('resource-item') ? 'products' : 'tasks';
  lockSection(type, true);
  const confirmation = element('div', 'delete-confirm');
  const prompt = element('p', '', `¿Eliminar «${label}»? Esta acción no se puede deshacer.`);
  const error = element('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const cancel = button('Cancelar', 'button button--secondary', () => {
    confirmation.remove();
    lockSection(type, false);
    trigger.focus();
  });
  const confirm = button('Sí, eliminar', 'button button--danger', async () => {
    cancel.disabled = true;
    confirm.disabled = true;
    error.hidden = true;
    try {
      await onDelete();
      lockSection(type, false);
      (type === 'products' ? productForm.elements.namedItem('code') : taskForm.elements.namedItem('title')).focus();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
      cancel.disabled = false;
      confirm.disabled = false;
      confirm.focus();
    }
  });
  confirmation.append(prompt, cancel, confirm, error);
  item.append(confirmation);
  cancel.focus();
}

function editProduct(product, item, trigger) {
  if (item.querySelector('.edit-form')) return;
  lockSection('products', true);
  const form = element('form', 'edit-form');
  form.noValidate = true;
  form.setAttribute('aria-label', `Editar ${product.name}`);
  const fields = element('div', 'edit-fields');
  fields.append(field('Nombre del recurso', 'name', product.name, { id: `edit-name-${product.id}`, minLength: 2, maxLength: 100 }), field('Cantidad', 'stock', product.stock, { id: `edit-stock-${product.id}`, type: 'number', min: '0', max: '1000000' }));
  const footer = element('div', 'form-footer');
  const error = element('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const cancel = button('Cancelar', 'button button--secondary', () => {
    form.remove();
    lockSection('products', false);
    trigger.focus();
  });
  const save = element('button', 'button', 'Guardar cambios');
  save.type = 'submit';
  footer.append(error, cancel, save);
  form.append(fields, footer);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    clearFormError(form, error);
    const body = validateProduct(form, error, false);
    if (!body) return;
    setPending(form, true);
    try {
      const { product: updated } = await request(`/api/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      products = products.map(entry => entry.id === product.id ? updated : entry);
      renderProducts();
      lockSection('products', false);
      document.querySelector(`#edit-product-${product.id}`)?.focus();
      notify(`Se actualizaron los datos de «${updated.name}».`);
    } catch (failure) {
      setPending(form, false);
      showFormError(form, error, failure.message, failure.fields);
      save.focus();
    }
  });
  item.append(form);
  form.elements.namedItem('name').focus();
}

function renderProducts() {
  document.querySelector('#products-count').textContent = products.length;
  if (!products.length) {
    productList.replaceChildren(emptyState('El taller está por estrenarse.', 'Añade el primer recurso con el formulario de arriba.'));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const product of products) {
    const item = element('article', 'resource-item');
    const summary = element('div', 'product-summary');
    const details = element('div');
    details.append(element('h3', 'resource-name', product.name), element('p', 'resource-code', product.code));
    const stock = element('span', 'resource-stock', new Intl.NumberFormat('es-CO').format(product.stock));
    stock.setAttribute('aria-label', `${product.stock} unidades`);
    const actions = element('div', 'item-actions');
    const edit = button('Editar', 'text-button', () => editProduct(product, item, edit));
    edit.id = `edit-product-${product.id}`;
    edit.setAttribute('aria-label', `Editar ${product.name}`);
    const remove = button('Eliminar', 'text-button danger-link', () => addDeleteConfirmation(item, remove, product.name, async () => {
      await request(`/api/products/${product.id}`, { method: 'DELETE' });
      products = products.filter(entry => entry.id !== product.id);
      renderProducts();
      productForm.elements.namedItem('code').focus();
      notify(`Se eliminó «${product.name}» del catálogo.`);
    }));
    remove.setAttribute('aria-label', `Eliminar ${product.name}`);
    actions.append(edit, remove);
    summary.append(details, stock, actions);
    item.append(summary);
    fragment.append(item);
  }
  productList.replaceChildren(fragment);
}

function renderTasks() {
  document.querySelector('#tasks-count').textContent = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  document.querySelector('#task-progress-text').textContent = `${completed} de ${tasks.length} ${tasks.length === 1 ? 'tarea completada' : 'tareas completadas'}`;
  const progress = document.querySelector('#task-progress');
  progress.max = tasks.length || 1;
  progress.value = completed;
  if (!tasks.length) {
    taskList.replaceChildren(emptyState('Una lista nueva para el equipo.', 'Escribe la primera tarea y márcala cuando esté lista.'));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const task of tasks) {
    const item = element('article', 'task-item');
    const summary = element('div', 'task-summary');
    const input = element('input', 'task-check');
    input.type = 'checkbox';
    input.id = `task-${task.id}`;
    input.checked = task.completed;
    const label = element('label', `task-label${task.completed ? ' is-completed' : ''}`, task.title);
    label.htmlFor = input.id;
    const remove = button('Eliminar', 'text-button danger-link', () => addDeleteConfirmation(item, remove, task.title, async () => {
      await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
      tasks = tasks.filter(entry => entry.id !== task.id);
      renderTasks();
      notify(`Se eliminó la tarea «${task.title}».`);
    }));
    remove.setAttribute('aria-label', `Eliminar la tarea ${task.title}`);
    input.addEventListener('change', async () => {
      lockSection('tasks', true);
      const completed = input.checked;
      try {
        const { task: updated } = await request(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed }) });
        tasks = tasks.map(entry => entry.id === task.id ? updated : entry);
        renderTasks();
        lockSection('tasks', false);
        document.querySelector(`#task-${task.id}`)?.focus();
        notify(completed ? `Tarea completada: «${task.title}».` : `Tarea pendiente: «${task.title}».`);
      } catch (failure) {
        input.checked = task.completed;
        lockSection('tasks', false);
        input.focus();
        notify(failure.message, 'error');
      }
    });
    summary.append(input, label, remove);
    item.append(summary);
    fragment.append(item);
  }
  taskList.replaceChildren(fragment);
}

async function loadProducts() {
  if (productList.dataset.loading === 'true') return;
  productList.dataset.loading = 'true';
  productList.setAttribute('aria-busy', 'true');
  lockSection('products', true);
  productList.replaceChildren(element('div', 'loading-state', 'Cargando los recursos…'));
  try {
    const data = await request('/api/products');
    products = data.products;
    renderProducts();
  } catch (error) {
    document.querySelector('#products-count').textContent = '—';
    showListError(productList, error, loadProducts);
  } finally {
    productList.dataset.loading = 'false';
    productList.setAttribute('aria-busy', 'false');
    lockSection('products', false);
  }
}

async function loadTasks() {
  if (taskList.dataset.loading === 'true') return;
  taskList.dataset.loading = 'true';
  taskList.setAttribute('aria-busy', 'true');
  lockSection('tasks', true);
  taskList.replaceChildren(element('div', 'loading-state', 'Cargando las tareas…'));
  try {
    const data = await request('/api/tasks');
    tasks = data.tasks;
    renderTasks();
  } catch (error) {
    document.querySelector('#tasks-count').textContent = '—';
    document.querySelector('#task-progress-text').textContent = 'No se pudieron consultar las tareas.';
    showListError(taskList, error, loadTasks);
  } finally {
    taskList.dataset.loading = 'false';
    taskList.setAttribute('aria-busy', 'false');
    lockSection('tasks', false);
  }
}

productForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (productForm.getAttribute('aria-busy') === 'true') return;
  const error = document.querySelector('#product-error');
  clearFormError(productForm, error);
  const body = validateProduct(productForm, error, true);
  if (!body) return;
  lockSection('products', true);
  try {
    const { product } = await request('/api/products', { method: 'POST', body: JSON.stringify(body) });
    products = [...products, product];
    renderProducts();
    productForm.reset();
    notify(`Se añadió «${product.name}» al catálogo de MariaDB.`);
  } catch (failure) {
    showFormError(productForm, error, failure.message, failure.fields);
  } finally {
    lockSection('products', false);
    if (error.hidden) productForm.elements.namedItem('code').focus();
    else productForm.querySelector('[aria-invalid=true]')?.focus();
  }
});

taskForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (taskForm.getAttribute('aria-busy') === 'true') return;
  const error = document.querySelector('#task-error');
  const input = taskForm.elements.namedItem('title');
  clearFormError(taskForm, error);
  const title = input.value.trim();
  if (title.length < 2 || title.length > 160) {
    showFormError(taskForm, error, 'Escribe una tarea de 2 a 160 caracteres.', { title: true });
    input.focus();
    return;
  }
  lockSection('tasks', true);
  try {
    const { task } = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
    tasks = [...tasks, task];
    renderTasks();
    taskForm.reset();
    notify(`Se añadió la tarea «${task.title}» en PostgreSQL.`);
  } catch (failure) {
    showFormError(taskForm, error, failure.message, failure.fields);
  } finally {
    lockSection('tasks', false);
    input.focus();
  }
});

for (const form of [productForm, taskForm]) {
  form.addEventListener('input', event => event.target.removeAttribute('aria-invalid'));
}
healthButton.addEventListener('click', checkHealth);
checkHealth();
loadProducts();
loadTasks();
