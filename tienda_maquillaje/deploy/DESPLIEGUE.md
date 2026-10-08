# Despliegue en la VM de OCI (Ubuntu) con Node.js

Sustituye `IP_PUBLICA` por la IP de tu instancia y `ubuntu` por tu usuario si es otro.

## 1. Conectarte por SSH (captura del banner de Ubuntu)
```bash
ssh -i llave_privada.key ubuntu@IP_PUBLICA
```

## 2. Instalar MySQL, Node.js 20 y Apache
El Node de los repositorios de Ubuntu suele ser muy viejo, por eso se instala desde NodeSource.
```bash
sudo apt update
sudo apt install -y mysql-server apache2 curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
sudo systemctl enable --now mysql
sudo systemctl enable --now apache2
sudo systemctl status mysql          # <- captura para el reporte
```

## 3. Subir el proyecto con FileZilla
- Edit → Settings → SFTP → *Add key file* (tu llave privada de OCI; acepta la conversión).
- Conexión rápida: Host `sftp://IP_PUBLICA`, usuario `ubuntu`, puerto `22`.
- Sube la carpeta `tienda_maquillaje` a `/home/ubuntu`. **No subas `node_modules`**; se instala en la VM.

## 4. Crear la base de datos y los usuarios (en la VM)
Antes, cambia las tres contraseñas en `sql/02_usuarios.sql`.
```bash
cd ~/tienda_maquillaje
sudo mysql < sql/01_schema.sql
sudo mysql < sql/02_usuarios.sql
sudo mysql tienda_maquillaje -e "SHOW TABLES; SELECT COUNT(*) FROM producto;"
```
Pruebas de seguridad: ejecuta los comandos de `sql/03_pruebas_seguridad.sql` y captura los que fallan con `ERROR 1142`.

## 5. Preparar la aplicación
```bash
sudo mkdir -p /opt/tienda
sudo cp -r ~/tienda_maquillaje/node_app/* /opt/tienda/
sudo chown -R $USER:$USER /opt/tienda
cd /opt/tienda
npm install --omit=dev
```

Variables de entorno (contraseña del usuario `app_webuser`):
```bash
sudo tee /etc/tienda.env >/dev/null <<'ENV'
DB_HOST=localhost
DB_USER=app_webuser
DB_PASSWORD=LA_CONTRASEÑA_QUE_PUSISTE
DB_NAME=tienda_maquillaje
PORT=3000
ENV
sudo chmod 600 /etc/tienda.env
```

Prueba rápida antes de dejarlo como servicio:
```bash
cd /opt/tienda && set -a && . /etc/tienda.env && set +a && node server.js
# en otra terminal SSH:  curl http://localhost:3000/api/productos
# Ctrl+C para detenerlo
```

## 6. Servicio en segundo plano (systemd)
```bash
sudo tee /etc/systemd/system/tienda.service >/dev/null <<'UNIT'
[Unit]
Description=Tienda de maquillaje (Node.js)
After=network.target mysql.service

[Service]
User=ubuntu
WorkingDirectory=/opt/tienda
EnvironmentFile=/etc/tienda.env
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now tienda
sudo systemctl status tienda         # <- captura para el reporte
```
Si prefieres PM2 en lugar de systemd: `sudo npm i -g pm2 && pm2 start server.js --name tienda && pm2 startup && pm2 save`.

## 7. Apache como proxy en el puerto 80
Apache recibe las peticiones públicas y las reenvía a Node, que escucha solo en `127.0.0.1:3000`. Así, `http://IP_PUBLICA/api` y `http://IP_PUBLICA/api/productos` llegan a Express; no se expone directamente el puerto 3000.
Si ya tenías la aplicación desplegada, usa FileZilla para reemplazar el archivo actualizado:
- En el panel local, abre `tienda_maquillaje/node_app/server.js`.
- En el panel remoto, abre `/home/ubuntu/` y sube únicamente `server.js`; debe quedar como `/home/ubuntu/server.js`.

Después, en la terminal conectada por SSH a la **VM**, instala esa versión y reinicia el servicio:
```bash
sudo install -o ubuntu -g ubuntu -m 644 /home/ubuntu/server.js /opt/tienda/server.js
sudo systemctl restart tienda
```
Después aplica la configuración del proxy de Apache:
```bash
sudo a2enmod proxy proxy_http headers
sudo tee /etc/apache2/sites-available/tienda.conf >/dev/null <<'APACHE'
<VirtualHost *:80>
    ServerName _
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ErrorLog ${APACHE_LOG_DIR}/tienda_error.log
    CustomLog ${APACHE_LOG_DIR}/tienda_access.log combined
</VirtualHost>
APACHE
sudo a2dissite 000-default
sudo a2ensite tienda
sudo apache2ctl configtest && sudo systemctl reload apache2
sudo systemctl status apache2        # <- captura para el reporte
```

## 8. Abrir el puerto 80

**a) En OCI (VCN):** Menú → Networking → Virtual Cloud Networks → tu VCN → tu Subnet → Security List → *Add Ingress Rules*
- Source Type: CIDR · Source CIDR: `0.0.0.0/0`
- IP Protocol: TCP · Destination Port Range: `80`

**b) En el firewall de Ubuntu** (las imágenes de OCI traen reglas iptables que bloquean el 80):
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```
(Si usas ufw en lugar de iptables: `sudo ufw allow 80/tcp`.)

## 9. Verificar
```bash
curl -i http://localhost/api
curl -i http://localhost/api/productos
curl -i http://IP_PUBLICA/api
curl -i http://IP_PUBLICA/api/productos
```
`/api` debe responder JSON con el nombre de la API y sus endpoints. `/api/productos` debe responder JSON con los productos; si devuelve un error de base de datos, revisa `DB_PASSWORD` y el estado de MySQL. Abre `http://IP_PUBLICA/api` en el navegador para comprobar el endpoint base.

## Si algo falla
- Error 404 con la página de Apache: revisa que el sitio `tienda` esté habilitado y que `proxy` y `proxy_http` estén activos.
- Error 502: `sudo journalctl -u tienda -n 30` muestra el error de Node; comprueba también `curl http://127.0.0.1:3000/api` en la VM.
- `ER_ACCESS_DENIED`: la contraseña de `/etc/tienda.env` no coincide con la de `app_webuser`.
- No abre desde fuera pero `curl localhost/api` sí: falta la regla del puerto 80 en OCI o en el firewall de Ubuntu.

## Capturas que pide el reporte (Fase IX)
1. Consola OCI: instancia en **Running**, IP pública y menú de perfil de usuario.
2. Terminal SSH con el banner de bienvenida de Ubuntu.
3. `sudo systemctl status mysql`, `sudo systemctl status tienda` y `sudo systemctl status apache2`.
4. Navegador en `http://IP_PUBLICA` mostrando la app con datos de MySQL.
5. (Extra que suma en las rúbricas 4 y 5) DDL ejecutado, `SELECT COUNT(*)` por tabla, `SHOW GRANTS` y los comandos bloqueados.
