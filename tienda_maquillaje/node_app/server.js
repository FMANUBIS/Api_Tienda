// Tienda de maquillaje - servidor Node.js (Express + mysql2)
// La app se conecta a MySQL con el usuario app_webuser (menor privilegio).
const path = require('path');
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const { hashPassword, normalizeUsername } = require('./auth');
const crearRouterV1 = require('./api_v1');

const app = express();
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'glow-studio-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false }
}));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ status: 'error', message: 'JSON mal formado en el cuerpo de la petición' });
  next(err);
});
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'app_webuser',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tienda_maquillaje',
  waitForConnections: true,
  connectionLimit: 5,
  decimalNumbers: true, // DECIMAL llega como número, no como texto
  dateStrings: true,    // fechas como texto 'AAAA-MM-DD hh:mm:ss' (sin desfase de zona horaria)
});

// ---------- API RESTful v1 (actividad U1 EP2) ----------
app.use('/api/v1/productos', crearRouterV1(pool));
app.use('/api/v1', (req, res) => res.status(404).json({ status: 'error', message: 'Ruta no encontrada' }));

// ---------- utilidades ----------
const ruta = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    const { status, mensaje } = traducirError(err);
    if (status === 500) console.error(err);
    res.status(status).json({ error: mensaje });
  });

function traducirError(err) {
  switch (err.errno) {
    case 1062: return { status: 409, mensaje: 'Ya existe un producto con ese SKU. Usa uno distinto.' };
    case 1451: return { status: 409, mensaje: 'No se puede eliminar: el producto aparece en pedidos existentes.' };
    case 1452: return { status: 400, mensaje: 'La marca o categoría elegida no existe.' };
    case 3819:
    case 4025: return { status: 400, mensaje: 'Un valor no cumple las reglas de la base (el precio debe ser mayor a 0).' };
    case 1142:
    case 1044: return { status: 403, mensaje: 'Este usuario de base de datos no tiene permiso para esa operación.' };
    default:   return { status: 500, mensaje: 'Ocurrió un error con la base de datos. Intenta de nuevo.' };
  }
}

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Debes iniciar sesión.' });
    if (req.session.user.role !== role) return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
    next();
  };
}

function validarProducto(b) {
  const errores = [];
  const sku = String(b.sku ?? '').trim().toUpperCase();
  const nombre = String(b.nombre ?? '').trim();
  const tono = String(b.tono ?? '').trim() || null;
  const precio = vacio(b.precio) ? NaN : Number(b.precio);
  const stock = vacio(b.stock) ? NaN : Number(b.stock);
  const id_marca = vacio(b.id_marca) ? NaN : Number(b.id_marca);
  const id_categoria = vacio(b.id_categoria) ? NaN : Number(b.id_categoria);

  if (!sku) errores.push('El SKU es obligatorio.');
  else if (sku.length > 20) errores.push('El SKU no puede pasar de 20 caracteres.');
  if (!nombre) errores.push('El nombre es obligatorio.');
  else if (nombre.length > 100) errores.push('El nombre no puede pasar de 100 caracteres.');
  if (tono && tono.length > 40) errores.push('El tono no puede pasar de 40 caracteres.');
  if (!Number.isFinite(precio)) errores.push('El precio no es un número válido.');
  else if (precio <= 0) errores.push('El precio debe ser mayor a 0.');
  if (!Number.isInteger(stock)) errores.push('El stock debe ser un número entero.');
  else if (stock < 0) errores.push('El stock no puede ser negativo.');
  if (!Number.isInteger(id_marca) || !Number.isInteger(id_categoria)) errores.push('Elige una marca y una categoría.');

  return { datos: { sku, nombre, tono, precio, stock, id_marca, id_categoria }, errores };
}

// ---------- autenticación ----------
app.get('/api', (req, res) => {
  res.json({
    nombre: 'API de Tienda de maquillaje',
    endpoints: [
      'GET /api/session',
      'POST /api/login',
      'POST /api/logout',
      'GET /api/catalogos',
      'GET /api/productos',
      'GET /api/productos/:id',
      'POST /api/productos',
      'PUT /api/productos/:id',
      'DELETE /api/productos/:id',
      'GET /api/clientes',
      'GET /api/clientes/me',
      'GET /api/pedidos',
      'GET /api/pedidos/:id'
    ]
  });
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'No hay sesión activa.' });
  res.json({ user: req.session.user });
});

app.post('/api/login', ruta(async (req, res) => {
  const username = String(req.body.username ?? '').trim();
  const password = String(req.body.password ?? '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  const valor = normalizeUsername(username);
  const [filas] = await pool.query(
    `SELECT u.id_usuario, u.nombre_usuario, u.email, u.password_hash, u.rol, u.id_cliente,
            c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
     FROM usuario u
     LEFT JOIN cliente c ON c.id_cliente = u.id_cliente
     WHERE u.activo = 1 AND (LOWER(u.email) = LOWER(?) OR LOWER(u.nombre_usuario) = LOWER(?))`,
    [valor, valor]
  );

  const usuario = filas[0];
  if (!usuario || hashPassword(password) !== usuario.password_hash) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }

  const user = {
    id: usuario.id_usuario,
    username: usuario.nombre_usuario || usuario.email,
    email: usuario.email,
    role: usuario.rol,
    id_cliente: usuario.id_cliente,
    nombre: usuario.rol === 'admin'
      ? 'Administrador'
      : `${usuario.cliente_nombre || ''} ${usuario.cliente_apellido || ''}`.trim() || usuario.nombre_usuario
  };

  req.session.user = user;
  res.json({ ok: true, user });
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------- catálogos ----------
app.get('/api/catalogos', ruta(async (req, res) => {
  const [marcas] = await pool.query('SELECT id_marca, nombre FROM marca ORDER BY nombre');
  const [categorias] = await pool.query('SELECT id_categoria, nombre FROM categoria ORDER BY nombre');
  res.json({ marcas, categorias });
}));

// ---------- productos (CRUD) ----------
const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.sku, p.nombre, p.tono, p.precio, p.stock,
         p.id_marca, p.id_categoria, m.nombre AS marca, c.nombre AS categoria
  FROM producto p
  JOIN marca m     ON m.id_marca = p.id_marca
  JOIN categoria c ON c.id_categoria = p.id_categoria`;

app.get('/api/productos', ruta(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  let sql = SELECT_PRODUCTO;
  const params = [];
  if (q) {
    sql += ' WHERE p.nombre LIKE ? OR p.sku LIKE ? OR m.nombre LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY c.nombre, p.nombre';
  const [filas] = await pool.query(sql, params);
  res.json(filas);
}));

app.get('/api/productos/:id', ruta(async (req, res) => {
  const [filas] = await pool.query(SELECT_PRODUCTO + ' WHERE p.id_producto = ?', [req.params.id]);
  if (!filas.length) return res.status(404).json({ error: 'Ese producto no existe.' });
  res.json(filas[0]);
}));

app.post('/api/productos', requireRole('admin'), ruta(async (req, res) => {
  const { datos, errores } = validarProducto(req.body);
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });
  const [r] = await pool.query(
    `INSERT INTO producto (sku, nombre, tono, precio, stock, id_marca, id_categoria)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [datos.sku, datos.nombre, datos.tono, datos.precio, datos.stock, datos.id_marca, datos.id_categoria]
  );
  res.status(201).json({ id_producto: r.insertId });
}));

app.put('/api/productos/:id', requireRole('admin'), ruta(async (req, res) => {
  const { datos, errores } = validarProducto(req.body);
  if (errores.length) return res.status(400).json({ error: errores.join(' ') });
  const [r] = await pool.query(
    `UPDATE producto SET sku=?, nombre=?, tono=?, precio=?, stock=?, id_marca=?, id_categoria=?
     WHERE id_producto=?`,
    [datos.sku, datos.nombre, datos.tono, datos.precio, datos.stock, datos.id_marca, datos.id_categoria, req.params.id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Ese producto no existe.' });
  res.json({ ok: true });
}));

app.delete('/api/productos/:id', requireRole('admin'), ruta(async (req, res) => {
  const [r] = await pool.query('DELETE FROM producto WHERE id_producto = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Ese producto no existe.' });
  res.json({ ok: true });
}));

// ---------- clientes y pedidos (lectura) ----------
app.get('/api/clientes/me', ruta(async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'cliente') {
    return res.status(403).json({ error: 'Necesitas iniciar sesión como clienta.' });
  }

  const [filas] = await pool.query(
    `SELECT c.id_cliente, c.nombre, c.apellido, c.email, c.telefono,
            pc.tipo_piel, pc.subtono, pc.preferencias
     FROM cliente c
     LEFT JOIN perfil_cliente pc ON pc.id_cliente = c.id_cliente
     WHERE c.id_cliente = ?`,
    [req.session.user.id_cliente]
  );

  if (!filas.length) return res.status(404).json({ error: 'No se encontró tu perfil.' });
  res.json({ cliente: filas[0] });
}));

app.get('/api/clientes', requireRole('admin'), ruta(async (req, res) => {
  const [filas] = await pool.query(
    `SELECT c.id_cliente, c.nombre, c.apellido, c.email, c.telefono,
            pc.tipo_piel, pc.subtono, pc.preferencias
     FROM cliente c
     LEFT JOIN perfil_cliente pc ON pc.id_cliente = c.id_cliente
     ORDER BY c.apellido, c.nombre`);
  res.json(filas);
}));

app.get('/api/pedidos', requireRole('admin'), ruta(async (req, res) => {
  const [filas] = await pool.query('SELECT * FROM v_pedido_resumen ORDER BY fecha_pedido DESC, id_pedido DESC');
  res.json(filas);
}));

app.get('/api/pedidos/:id', requireRole('admin'), ruta(async (req, res) => {
  const [cab] = await pool.query('SELECT * FROM v_pedido_resumen WHERE id_pedido = ?', [req.params.id]);
  if (!cab.length) return res.status(404).json({ error: 'Ese pedido no existe.' });
  const [lineas] = await pool.query(
    `SELECT p.nombre, p.tono, d.cantidad, d.precio_unitario,
            d.cantidad * d.precio_unitario AS subtotal
     FROM detalle_pedido d
     JOIN producto p ON p.id_producto = d.id_producto
     WHERE d.id_pedido = ?`, [req.params.id]);
  res.json({ pedido: cab[0], lineas });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '127.0.0.1', () => console.log(`Tienda de maquillaje escuchando en 127.0.0.1:${PORT}`));
