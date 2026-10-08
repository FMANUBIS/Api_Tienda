# Tienda de maquillaje (MySQL + Node.js)

- `docs/FASES_I_a_IV.md`: caso de estudio, entidades, normalización y diagrama (Fases I a IV)
- `sql/01_schema.sql`: DDL + 5 o más registros por tabla (Fase V)
- `sql/02_usuarios.sql`: app_admin, app_operativo, app_webuser (Fase VI)
- `sql/03_pruebas_seguridad.sql`: comandos para demostrar permisos y bloqueos
- `node_app/`: aplicación web (Fase VII)
  - `server.js`: API con Express y el driver mysql2
  - `public/`: interfaz en HTML, CSS y JavaScript
- `deploy/DESPLIEGUE.md`: guía paso a paso para la VM de OCI (Fase VIII y capturas de la IX)

Prueba local: `cd node_app && npm install && DB_PASSWORD=... node server.js` y abre http://localhost:3000
