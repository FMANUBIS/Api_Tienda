// Interfaz de la tienda: HTML + CSS + JavaScript puro que consume la API de Node.
const $ = (s) => document.querySelector(s);
const money = (n) => '$' + Number(n).toFixed(2);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

async function api(url, opciones = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opciones });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
  return data;
}

const estado = { q: '', flash: null, catalogos: null, user: null };
const flashHtml = () => {
  if (!estado.flash) return '';
  const { tipo, texto } = estado.flash;
  estado.flash = null;
  return `<p class="flash ${tipo}" role="status">${esc(texto)}</p>`;
};

function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  const user = estado.user;
  const items = [
    { key: 'productos', label: 'Productos' },
    { key: 'clientes', label: 'Clientas' },
    { key: 'pedidos', label: 'Pedidos' }
  ];
  nav.innerHTML = items.map((item) => `<button data-go="${item.key}" class="${item.key === 'productos' ? 'active' : ''}">${item.label}</button>`).join('');
  const sessionInfo = $('#sessionInfo');
  if (!sessionInfo) return;
  if (!user) {
    sessionInfo.innerHTML = '<button class="btn small" data-go="login">Iniciar sesión</button>';
    return;
  }
  sessionInfo.innerHTML = `<span>Hola, ${esc(user.nombre)}</span> <button class="btn ghost small" data-action="logout">Salir</button>`;
}

async function cargarSesion() {
  try {
    const data = await api('/api/session');
    estado.user = data.user;
  } catch (err) {
    estado.user = null;
  }
  renderNav();
}

const vistas = {
  async login() {
    $('#app').innerHTML = `${flashHtml()}
      <div class="auth-shell">
        <div class="auth-card">
          <h1>Iniciar sesión</h1>
          <p class="sub">Accede como administrador o como clienta.</p>
          <form id="loginForm" class="stack" novalidate>
            <div>
              <label for="username">Usuario o correo</label>
              <input id="username" name="username" placeholder="admin o nombre@correo.com" required>
            </div>
            <div>
              <label for="password">Contraseña</label>
              <input id="password" name="password" type="password" placeholder="••••••••" required>
            </div>
            <div id="loginError"></div>
            <div class="auth-actions">
              <button class="btn" type="submit">Entrar</button>
            </div>
          </form>
          <p class="hint">Credenciales demo: admin / admin123 o sofia.ramirez@example.com / cliente123</p>
        </div>
      </div>`;
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('#username').value;
      const password = $('#password').value;
      try {
        const data = await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        estado.user = data.user;
        renderNav();
        estado.flash = { tipo: 'ok', texto: 'Sesión iniciada correctamente.' };
        mostrar('productos');
      } catch (err) {
        $('#loginError').innerHTML = `<p class="flash error" role="alert">${esc(err.message)}</p>`;
      }
    });
  },

  async productos() {
    if (!estado.user) return mostrar('login');
    $('#app').innerHTML = flashHtml() + `
      <div class="head">
        <div><h1>Productos</h1><p class="sub" id="cuenta"></p></div>
        ${estado.user.role === 'admin' ? '<button class="btn" id="nuevo">Agregar producto</button>' : ''}
      </div>
      <div class="search">
        <input type="search" id="q" value="${esc(estado.q)}" placeholder="Buscar por nombre, SKU o marca" aria-label="Buscar productos">
      </div>
      <div class="tablewrap" id="tabla"></div>`;
    if (estado.user.role === 'admin') $('#nuevo').onclick = () => mostrar('form');
    let espera;
    $('#q').addEventListener('input', (e) => {
      estado.q = e.target.value;
      clearTimeout(espera);
      espera = setTimeout(cargarTabla, 250);
    });
    $('#tabla').addEventListener('click', clickTabla);
    await cargarTabla();
  },

  async form(id) {
    if (!estado.user || estado.user.role !== 'admin') return mostrar('productos');
    if (!estado.catalogos) estado.catalogos = await api('/api/catalogos');
    const { marcas, categorias } = estado.catalogos;
    const p = id ? await api('/api/productos/' + id)
                 : { sku: '', nombre: '', tono: '', precio: '', stock: '', id_marca: '', id_categoria: '' };
    const opts = (lista, clave, sel) => lista.map((o) =>
      `<option value="${o[clave]}" ${String(o[clave]) === String(sel) ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('');
    $('#app').innerHTML = `
      <div class="head"><h1>${id ? 'Editar producto' : 'Nuevo producto'}</h1></div>
      <div id="errores"></div>
      <form class="card" id="f" novalidate>
        <div class="grid">
          <div><label for="sku">SKU</label><input id="sku" maxlength="20" required value="${esc(p.sku)}"></div>
          <div><label for="tono">Tono (opcional)</label><input id="tono" maxlength="40" value="${esc(p.tono)}"></div>
          <div class="full"><label for="nombre">Nombre</label><input id="nombre" maxlength="100" required value="${esc(p.nombre)}"></div>
          <div><label for="id_marca">Marca</label>
            <select id="id_marca" required><option value="">Elige una marca</option>${opts(marcas, 'id_marca', p.id_marca)}</select></div>
          <div><label for="id_categoria">Categoría</label>
            <select id="id_categoria" required><option value="">Elige una categoría</option>${opts(categorias, 'id_categoria', p.id_categoria)}</select></div>
          <div><label for="precio">Precio (MXN)</label><input id="precio" type="number" step="0.01" min="0.01" required value="${esc(p.precio)}"></div>
          <div><label for="stock">Stock</label><input id="stock" type="number" step="1" min="0" required value="${esc(p.stock)}"></div>
        </div>
        <div class="form-actions">
          <button class="btn" type="submit">Guardar producto</button>
          <button class="btn ghost" type="button" id="cancelar">Cancelar</button>
        </div>
      </form>`;
    $('#cancelar').onclick = () => mostrar('productos');
    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cuerpo = {};
      ['sku', 'nombre', 'tono', 'precio', 'stock', 'id_marca', 'id_categoria']
        .forEach((k) => { cuerpo[k] = $('#' + k).value; });
      try {
        await api(id ? '/api/productos/' + id : '/api/productos',
                  { method: id ? 'PUT' : 'POST', body: JSON.stringify(cuerpo) });
        estado.flash = { tipo: 'ok', texto: id ? 'Cambios guardados.' : 'Producto guardado.' };
        mostrar('productos');
      } catch (err) {
        $('#errores').innerHTML = `<p class="flash error" role="alert">${esc(err.message)}</p>`;
      }
    });
  },

  async clientes() {
    if (!estado.user || estado.user.role !== 'admin') return mostrar('login');
    const filas = await api('/api/clientes');
    $('#app').innerHTML = `
      <div class="head"><div><h1>Clientas</h1><p class="sub">${filas.length} registradas, con su perfil de piel</p></div></div>
      <div class="tablewrap">${filas.length ? `<table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Piel</th><th>Subtono</th><th>Preferencias</th></tr></thead>
        <tbody>${filas.map((c) => `<tr>
          <td>${esc(c.nombre)} ${esc(c.apellido)}</td><td>${esc(c.email)}</td><td>${esc(c.telefono) || '—'}</td>
          <td>${c.tipo_piel ? `<span class="pill">${esc(c.tipo_piel)}</span>` : '—'}</td>
          <td>${esc(c.subtono) || '—'}</td><td class="tono">${esc(c.preferencias) || '—'}</td></tr>`).join('')}
        </tbody></table>` : '<p class="empty">Todavía no hay clientas registradas.</p>'}</div>`;
  },

  async pedidos() {
    if (!estado.user || estado.user.role !== 'admin') return mostrar('login');
    const filas = await api('/api/pedidos');
    $('#app').innerHTML = `
      <div class="head"><div><h1>Pedidos</h1><p class="sub">${filas.length} pedidos registrados</p></div></div>
      <div class="tablewrap">${filas.length ? `<table>
        <thead><tr><th>Pedido</th><th>Fecha</th><th>Clienta</th><th>Estado</th><th>Pago</th><th class="num">Artículos</th><th class="num">Total</th></tr></thead>
        <tbody>${filas.map((p) => `<tr>
          <td><a href="#" data-ped="${p.id_pedido}">#${p.id_pedido}</a></td><td>${fecha(p.fecha_pedido)}</td>
          <td>${esc(p.cliente)}</td><td><span class="pill">${esc(p.estado)}</span></td><td>${esc(p.metodo_pago)}</td>
          <td class="num">${p.articulos}</td><td class="num">${money(p.total)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="empty">No hay pedidos todavía.</p>'}</div>`;
  },

  async detalle(id) {
    if (!estado.user || estado.user.role !== 'admin') return mostrar('login');
    const { pedido: p, lineas } = await api('/api/pedidos/' + id);
    $('#app').innerHTML = `
      <div class="head">
        <div><h1>Pedido #${p.id_pedido}</h1><p class="sub">${esc(p.cliente)} · ${fecha(p.fecha_pedido)} · ${esc(p.estado)}</p></div>
        <button class="btn ghost" data-go="pedidos">Volver a pedidos</button>
      </div>
      <div class="tablewrap"><table>
        <thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${lineas.map((l) => `<tr>
          <td>${esc(l.nombre)}${l.tono ? `<br><span class="tono">Tono ${esc(l.tono)}</span>` : ''}</td>
          <td class="num">${l.cantidad}</td><td class="num">${money(l.precio_unitario)}</td><td class="num">${money(l.subtotal)}</td></tr>`).join('')}
        </tbody></table></div>
      <p class="total">Total ${money(p.total)}</p>`;
  },
};

async function cargarTabla() {
  try {
    const filas = await api('/api/productos?q=' + encodeURIComponent(estado.q));
    $('#cuenta').textContent = filas.length + ' en el catálogo';
    $('#tabla').innerHTML = filas.length ? `<table>
      <thead><tr><th>SKU</th><th>Producto</th><th>Marca</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock</th>${estado.user && estado.user.role === 'admin' ? '<th></th>' : ''}</tr></thead>
      <tbody>${filas.map((p) => `<tr>
        <td class="sku">${esc(p.sku)}</td>
        <td>${esc(p.nombre)}${p.tono ? `<br><span class="tono">Tono ${esc(p.tono)}</span>` : ''}</td>
        <td>${esc(p.marca)}</td><td>${esc(p.categoria)}</td>
        <td class="num">${money(p.precio)}</td>
        <td class="num ${p.stock < 20 ? 'low' : ''}">${p.stock}</td>
        ${estado.user && estado.user.role === 'admin' ? `<td class="acciones">
          <button class="btn ghost small" data-edit="${p.id_producto}">Editar</button>
          <button class="btn danger small" data-del="${p.id_producto}" data-nombre="${esc(p.nombre)}">Eliminar</button>
        </td>` : ''}</tr>`).join('')}
      </tbody></table>`
      : '<p class="empty">No hay productos con esa búsqueda. Prueba otra palabra o agrega uno nuevo.</p>';
  } catch (err) {
    $('#tabla').innerHTML = `<p class="flash error">${esc(err.message)}</p>`;
  }
}

async function clickTabla(e) {
  const b = e.target.closest('[data-edit],[data-del]');
  if (!b) return;
  if (b.dataset.edit) return mostrar('form', b.dataset.edit);
  if (!confirm('¿Eliminar ' + b.dataset.nombre + '?')) return;
  try {
    await api('/api/productos/' + b.dataset.del, { method: 'DELETE' });
    estado.flash = { tipo: 'ok', texto: 'Producto eliminado.' };
  } catch (err) {
    estado.flash = { tipo: 'error', texto: err.message };
  }
  mostrar('productos');
}

async function mostrar(vista, arg) {
  if (!estado.user && vista !== 'login') {
    vista = 'login';
  }
  const activo = { productos: 'productos', form: 'productos', clientes: 'clientes', pedidos: 'pedidos', detalle: 'pedidos', login: 'productos' }[vista];
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.go === activo));
  try {
    await vistas[vista](arg);
  } catch (err) {
    $('#app').innerHTML = `<div class="head"><h1>Algo salió mal</h1></div><p class="flash error">${esc(err.message)}</p>`;
  }
  window.scrollTo(0, 0);
}

document.addEventListener('click', async (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn && actionBtn.dataset.action === 'logout') {
    await api('/api/logout', { method: 'POST' });
    estado.user = null;
    renderNav();
    estado.flash = { tipo: 'ok', texto: 'Sesión cerrada.' };
    mostrar('login');
    return;
  }

  const t = e.target.closest('[data-go],[data-ped]');
  if (!t) return;
  if (t.dataset.ped) { e.preventDefault(); mostrar('detalle', t.dataset.ped); }
  else { if (t.dataset.go !== 'productos') estado.q = ''; mostrar(t.dataset.go); }
});
document.querySelector('.brand').addEventListener('keydown', (e) => { if (e.key === 'Enter') mostrar('productos'); });

(async () => {
  await cargarSesion();
  if (estado.user) {
    mostrar('productos');
  } else {
    mostrar('login');
  }
})();
