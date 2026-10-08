-- =====================================================================
-- Usuarios y roles (principio de menor privilegio)
-- Ejecutar como root:  sudo mysql < 02_usuarios.sql
-- IMPORTANTE: cambia las contraseñas antes de ejecutar.
-- =====================================================================
CREATE USER IF NOT EXISTS 'app_admin'@'localhost'     IDENTIFIED BY 'Carlos123';
CREATE USER IF NOT EXISTS 'app_operativo'@'localhost' IDENTIFIED BY 'op123';
CREATE USER IF NOT EXISTS 'app_webuser'@'localhost'   IDENTIFIED BY 'web123';

-- 1) Administradora: control total sobre la base
GRANT ALL PRIVILEGES ON tienda_maquillaje.* TO 'app_admin'@'localhost';

-- 2) Operativo: CRUD solo en tablas de operación diaria; lectura del catálogo
GRANT SELECT, INSERT, UPDATE, DELETE ON tienda_maquillaje.cliente        TO 'app_operativo'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON tienda_maquillaje.perfil_cliente TO 'app_operativo'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON tienda_maquillaje.pedido         TO 'app_operativo'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON tienda_maquillaje.detalle_pedido TO 'app_operativo'@'localhost';
GRANT SELECT ON tienda_maquillaje.producto  TO 'app_operativo'@'localhost';
GRANT SELECT ON tienda_maquillaje.marca     TO 'app_operativo'@'localhost';
GRANT SELECT ON tienda_maquillaje.categoria TO 'app_operativo'@'localhost';

-- 3) Servicio web: lectura de todo + CRUD únicamente sobre producto
GRANT SELECT ON tienda_maquillaje.* TO 'app_webuser'@'localhost';
GRANT INSERT, UPDATE, DELETE ON tienda_maquillaje.producto TO 'app_webuser'@'localhost';

FLUSH PRIVILEGES;

SHOW GRANTS FOR 'app_admin'@'localhost';
SHOW GRANTS FOR 'app_operativo'@'localhost';
SHOW GRANTS FOR 'app_webuser'@'localhost';
