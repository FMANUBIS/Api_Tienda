-- A) app_webuser: DEBE funcionar
--    mysql -u app_webuser -p tienda_maquillaje -e "SELECT COUNT(*) FROM producto;"
--    mysql -u app_webuser -p tienda_maquillaje -e "UPDATE producto SET stock = stock WHERE id_producto = 1;"

-- B) app_webuser: DEBE fallar (ERROR 1142 ... command denied)
--    mysql -u app_webuser -p tienda_maquillaje -e "DELETE FROM cliente WHERE id_cliente = 1;"
--    mysql -u app_webuser -p tienda_maquillaje -e "DROP TABLE producto;"
--    mysql -u app_webuser -p tienda_maquillaje -e "INSERT INTO marca (nombre,pais_origen) VALUES ('X','Y');"

-- C) app_operativo: DEBE funcionar
--    mysql -u app_operativo -p tienda_maquillaje -e "UPDATE pedido SET estado='pagado' WHERE id_pedido=4;"

-- D) app_operativo: DEBE fallar
--    mysql -u app_operativo -p tienda_maquillaje -e "UPDATE producto SET precio=1 WHERE id_producto=1;"
--    mysql -u app_operativo -p tienda_maquillaje -e "CREATE TABLE prueba (id INT);"

-- E) app_admin: DEBE funcionar todo
--    mysql -u app_admin -p tienda_maquillaje -e "CREATE TABLE prueba (id INT); DROP TABLE prueba;"

-- F) Integridad referencial (como app_admin): DEBE fallar por RESTRICT (ERROR 1451)
--    mysql -u app_admin -p tienda_maquillaje -e "DELETE FROM producto WHERE id_producto = 1;"
