-- =====================================================================
-- Tienda de maquillaje - Esquema (DDL) y datos de prueba
-- Motor: MySQL 8.x  |  Ejecutar como root:  sudo mysql < 01_schema.sql
-- =====================================================================
SET NAMES utf8mb4;
DROP DATABASE IF EXISTS tienda_maquillaje;
CREATE DATABASE tienda_maquillaje
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tienda_maquillaje;

-- ---------- Catálogos ----------
CREATE TABLE marca (
  id_marca     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(60)  NOT NULL,
  pais_origen  VARCHAR(40)  NOT NULL,
  PRIMARY KEY (id_marca),
  UNIQUE KEY uq_marca_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE categoria (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(50)  NOT NULL,
  descripcion  VARCHAR(150),
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categoria_nombre (nombre)
) ENGINE=InnoDB;

-- ---------- Producto (N:1 con marca y categoría) ----------
CREATE TABLE producto (
  id_producto  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku          VARCHAR(20)  NOT NULL,
  nombre       VARCHAR(100) NOT NULL,
  tono         VARCHAR(40),
  precio       DECIMAL(8,2) NOT NULL,
  stock        INT UNSIGNED NOT NULL DEFAULT 0,
  id_marca     INT UNSIGNED NOT NULL,
  id_categoria INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_producto),
  UNIQUE KEY uq_producto_sku (sku),
  CONSTRAINT ck_producto_precio CHECK (precio > 0),
  CONSTRAINT fk_producto_marca FOREIGN KEY (id_marca)
    REFERENCES marca (id_marca) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria)
    REFERENCES categoria (id_categoria) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Cliente y su perfil (1:1) ----------
CREATE TABLE cliente (
  id_cliente     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(60)  NOT NULL,
  apellido       VARCHAR(60)  NOT NULL,
  email          VARCHAR(100) NOT NULL,
  telefono       VARCHAR(15),
  fecha_registro DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente),
  UNIQUE KEY uq_cliente_email (email)
) ENGINE=InnoDB;

CREATE TABLE perfil_cliente (
  id_cliente   INT UNSIGNED NOT NULL,            -- PK y FK a la vez => 1:1
  tipo_piel    ENUM('seca','grasa','mixta','normal','sensible') NOT NULL,
  subtono      ENUM('frio','calido','neutro') NOT NULL,
  preferencias VARCHAR(150),
  PRIMARY KEY (id_cliente),
  CONSTRAINT fk_perfil_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Usuario de acceso a la app ----------
CREATE TABLE usuario (
  id_usuario      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_usuario  VARCHAR(80) NOT NULL,
  email           VARCHAR(100) NOT NULL,
  password_hash   CHAR(64) NOT NULL,
  rol             ENUM('admin','cliente') NOT NULL,
  id_cliente      INT UNSIGNED NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_nombre (nombre_usuario),
  UNIQUE KEY uq_usuario_email (email),
  CONSTRAINT fk_usuario_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Pedido (1:N con cliente) ----------
CREATE TABLE pedido (
  id_pedido    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente   INT UNSIGNED NOT NULL,
  fecha_pedido DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado       ENUM('pendiente','pagado','enviado','entregado','cancelado')
               NOT NULL DEFAULT 'pendiente',
  metodo_pago  ENUM('efectivo','tarjeta','transferencia') NOT NULL,
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Detalle (resuelve N:M pedido <-> producto) ----------
CREATE TABLE detalle_pedido (
  id_pedido       INT UNSIGNED NOT NULL,
  id_producto     INT UNSIGNED NOT NULL,
  cantidad        INT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(8,2) NOT NULL,          -- precio al momento de la venta
  PRIMARY KEY (id_pedido, id_producto),
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido)
    REFERENCES pedido (id_pedido) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------- Vista: total por pedido (el total se calcula, no se guarda: 3FN) ----------
CREATE VIEW v_pedido_resumen AS
SELECT p.id_pedido,
       p.fecha_pedido,
       p.estado,
       p.metodo_pago,
       CONCAT(c.nombre, ' ', c.apellido) AS cliente,
       SUM(d.cantidad)                   AS articulos,
       SUM(d.cantidad * d.precio_unitario) AS total
FROM pedido p
JOIN cliente c        ON c.id_cliente = p.id_cliente
JOIN detalle_pedido d ON d.id_pedido  = p.id_pedido
GROUP BY p.id_pedido, p.fecha_pedido, p.estado, p.metodo_pago, c.nombre, c.apellido;

-- =====================================================================
-- Datos de prueba (mínimo 5 por tabla)
-- =====================================================================
INSERT INTO marca (nombre, pais_origen) VALUES
 ('Maybelline','Estados Unidos'),
 ('L''Oréal Paris','Francia'),
 ('NYX Professional','Estados Unidos'),
 ('Revlon','Estados Unidos'),
 ('Essence','Alemania');

INSERT INTO categoria (nombre, descripcion) VALUES
 ('Labiales','Barras, líquidos y bálsamos de color'),
 ('Bases y correctores','Cobertura para el rostro'),
 ('Ojos','Máscaras de pestañas, delineadores y sombras'),
 ('Rubor e iluminador','Color y luz para mejillas'),
 ('Brochas y accesorios','Herramientas de aplicación');

INSERT INTO producto (sku, nombre, tono, precio, stock, id_marca, id_categoria) VALUES
 ('LAB-001','Superstay Matte Ink','Pioneer',219.00,25,1,1),
 ('LAB-002','Color Riche Satin','Rosewood',189.00,30,2,1),
 ('BAS-001','Fit Me Base Mate','230 Natural Buff',199.00,40,1,2),
 ('BAS-002','Infalible Corrector','Medio',229.00,20,2,2),
 ('OJO-001','Máscara Lash Sensational','Negro',209.00,35,1,3),
 ('OJO-002','Delineador Epic Ink','Negro',175.00,28,3,3),
 ('ROS-001','Rubor Sweet Cheeks','Coral',149.00,18,3,4),
 ('ROS-002','Iluminador Glow','Champagne',129.00,22,5,4),
 ('ACC-001','Brocha kabuki para base',NULL,99.00,50,5,5),
 ('ACC-002','Esponja de maquillaje','Rosa',89.00,45,4,5);

INSERT INTO cliente (nombre, apellido, email, telefono) VALUES
 ('Sofía','Ramírez','sofia.ramirez@example.com','8711000001'),
 ('Daniela','Herrera','daniela.herrera@example.com','8711000002'),
 ('Mariana','López','mariana.lopez@example.com','8711000003'),
 ('Valeria','Torres','valeria.torres@example.com','8711000004'),
 ('Camila','Ortega','camila.ortega@example.com','8711000005'),
 ('Fernanda','Ruiz','fernanda.ruiz@example.com','8711000006');

INSERT INTO perfil_cliente (id_cliente, tipo_piel, subtono, preferencias) VALUES
 (1,'mixta','calido','Labiales mate'),
 (2,'seca','neutro','Acabado luminoso'),
 (3,'grasa','frio','Productos de larga duración'),
 (4,'normal','calido','Maquillaje natural'),
 (5,'sensible','neutro','Fórmulas suaves'),
 (6,'mixta','frio','Ojos marcados');

INSERT INTO usuario (nombre_usuario, email, password_hash, rol, id_cliente) VALUES
 ('admin', 'admin@glowstudio.com', SHA2('admin123', 256), 'admin', NULL),
 ('daniela.herrera', 'daniela.herrera@example.com', SHA2('cliente123', 256), 'cliente', 2),
 ('mariana.lopez', 'mariana.lopez@example.com', SHA2('cliente123', 256), 'cliente', 3),
 ('valeria.torres', 'valeria.torres@example.com', SHA2('cliente123', 256), 'cliente', 4),
 ('camila.ortega', 'camila.ortega@example.com', SHA2('cliente123', 256), 'cliente', 5),
 ('fernanda.ruiz', 'fernanda.ruiz@example.com', SHA2('cliente123', 256), 'cliente', 6);

INSERT INTO pedido (id_cliente, estado, metodo_pago) VALUES
 (1,'entregado','tarjeta'),
 (2,'pagado','transferencia'),
 (3,'enviado','efectivo'),
 (4,'pendiente','efectivo'),
 (5,'entregado','tarjeta'),
 (1,'pagado','tarjeta');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
 (1,1,1,219.00),(1,3,1,199.00),
 (2,2,2,189.00),(2,7,1,149.00),
 (3,5,1,209.00),(3,6,1,175.00),(3,9,1,99.00),
 (4,4,1,229.00),(4,8,1,129.00),
 (5,10,3,89.00),
 (6,2,1,189.00),(6,5,1,209.00);
