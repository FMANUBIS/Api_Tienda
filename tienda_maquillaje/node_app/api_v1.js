// API RESTful v1 - recurso: productos (tienda de maquillaje)
// Todas las respuestas son JSON con el formato { status, message, ... }
const express = require('express');

const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.sku, p.nombre, p.tono, p.precio, p.stock,
         p.id_marca, p.id_categoria, m.nombre AS marca, c.nombre AS categoria
  FROM producto p
  JOIN marca m     ON m.id_marca = p.id_marca
  JOIN categoria c ON c.id_categoria = p.id_categoria`;

const ok = (res, code, message, extra = {}) => res.status(code).json({ status: 'success', message, ...extra });
const fail = (res, code, message, extra = {}) => res.status(code).json({ status: 'error', message, ...extra });

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';

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
  if (!Number.isInteger(id_marca)) errores.push('id_marca debe ser un entero.');
  if (!Number.isInteger(id_categoria)) errores.push('id_categoria debe ser un entero.');

  return { datos: { sku, nombre, tono, precio, stock, id_marca, id_categoria }, errores };
}

function traducirError(err) {
  switch (err.errno) {
    case 1062: return [400, 'Ya existe un producto con ese SKU.'];
    case 1451: return [400, 'No se puede eliminar: el producto aparece en pedidos existentes.'];
    case 1452: return [400, 'La marca o categoría indicada no existe.'];
    case 3819:
    case 4025: return [400, 'Un valor no cumple las reglas de la base (el precio debe ser mayor a 0).'];
    default:   return [500, 'Error interno del servidor.'];
  }
}

module.exports = function crearRouter(pool) {
  const router = express.Router();
  const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    const [code, msg] = traducirError(err);
    if (code === 500) console.error(err);
    fail(res, code, msg);
  });

  const idValido = (v) => /^\d+$/.test(String(v));

  // GET /api/v1/productos
  router.get('/', wrap(async (req, res) => {
    const [filas] = await pool.query(SELECT_PRODUCTO + ' ORDER BY p.id_producto');
    ok(res, 200, 'Lista de productos obtenida correctamente', { total: filas.length, data: filas });
  }));

  // GET /api/v1/productos/:id
  router.get('/:id', wrap(async (req, res) => {
    if (!idValido(req.params.id)) return fail(res, 404, 'Producto no encontrado');
    const [filas] = await pool.query(SELECT_PRODUCTO + ' WHERE p.id_producto = ?', [req.params.id]);
    if (!filas.length) return fail(res, 404, 'Producto no encontrado');
    ok(res, 200, 'Producto obtenido correctamente', { data: filas[0] });
  }));

  // POST /api/v1/productos
  router.post('/', wrap(async (req, res) => {
    const { datos, errores } = validarProducto(req.body || {});
    if (errores.length) return fail(res, 400, 'Datos inválidos', { errores });
    const [r] = await pool.query(
      `INSERT INTO producto (sku, nombre, tono, precio, stock, id_marca, id_categoria) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [datos.sku, datos.nombre, datos.tono, datos.precio, datos.stock, datos.id_marca, datos.id_categoria]
    );
    ok(res, 201, 'Registro creado exitosamente', { id: r.insertId });
  }));

  // PUT /api/v1/productos/:id
  router.put('/:id', wrap(async (req, res) => {
    const { datos, errores } = validarProducto(req.body || {});
    if (errores.length) return fail(res, 400, 'Datos inválidos', { errores });
    if (!idValido(req.params.id)) return fail(res, 404, 'Producto no encontrado');
    const [r] = await pool.query(
      `UPDATE producto SET sku=?, nombre=?, tono=?, precio=?, stock=?, id_marca=?, id_categoria=? WHERE id_producto=?`,
      [datos.sku, datos.nombre, datos.tono, datos.precio, datos.stock, datos.id_marca, datos.id_categoria, req.params.id]
    );
    if (!r.affectedRows) return fail(res, 404, 'Producto no encontrado');
    ok(res, 200, 'Registro actualizado correctamente');
  }));

  // DELETE /api/v1/productos/:id
  router.delete('/:id', wrap(async (req, res) => {
    if (!idValido(req.params.id)) return fail(res, 404, 'Producto no encontrado');
    const [r] = await pool.query('DELETE FROM producto WHERE id_producto = ?', [req.params.id]);
    if (!r.affectedRows) return fail(res, 404, 'Producto no encontrado');
    ok(res, 200, 'Registro eliminado correctamente');
  }));

  return router;
};
