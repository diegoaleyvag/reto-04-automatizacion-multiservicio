# Manual de operación

**Integrantes: Sebastián y Santiago.**

Ejecuta los comandos desde la carpeta que contiene `compose.yaml`. Docker debe estar funcionando. GNU Make es necesario para los comandos `make`; las alternativas directas no necesitan instalar Node.js ni los clientes de las bases de datos.

## Comandos

| Acción | Con Make | Alternativa |
| --- | --- | --- |
| Ayuda | `make` | Leer este manual |
| Construir e iniciar | `make iniciar` | `docker compose up --build -d --wait --wait-timeout 180` |
| Estado de los servicios | `make estado` | `docker compose ps` |
| Registros recientes | `make registros` | `docker compose logs --tail=80` |
| Construir imágenes | `make construir` | `docker compose build` |
| Pruebas funcionales | `make probar` | `docker compose exec -T backend npm test` |
| Sembrar ejemplos | `make sembrar` | `docker compose exec -T backend npm run seed` |
| Respaldar | `make respaldar` | `sh scripts/respaldar.sh` |
| Verificar respaldo | `make verificar-respaldo` | `sh scripts/verificar-respaldo.sh` |
| Detener conservando datos | `make detener` | `docker compose down` |

Las alternativas `sh` se ejecutan en una terminal POSIX: Terminal de macOS, Linux, WSL o Git Bash. En PowerShell se pueden ejecutar directamente el inicio, estado, registros, pruebas y sembrado; consulta [WINDOWS.md](WINDOWS.md) para los respaldos.

El Makefile usa objetivos `.PHONY`, variables configurables y `.NOTPARALLEL` para mantener el orden de operaciones incluso si se invoca con `-j`. `COMPOSE` permite cambiar el comando de Compose, y `APP_PORT` configura el puerto publicado.

## Sembrado idempotente

```sh
make sembrar
make sembrar
```

Las claves de los tres productos y de las tres tareas de demostración son estables. El sembrado agrega ejemplos ausentes y conserva los existentes: no duplica registros ni reemplaza nombres, cantidades o estados modificados por el usuario. Los esquemas iniciales cargan los mismos ejemplos al crear los volúmenes.

## Generar respaldos SQL

```sh
make respaldar
make verificar-respaldo
```

El primer comando crea una carpeta `respaldos/` con fecha UTC y un identificador. La ruta exacta aparece al terminar y queda anotada en `respaldos/ultimo`.

| Archivo | Contenido |
| --- | --- |
| `postgres.sql` | Esquema y datos generados por `pg_dump` |
| `mariadb.sql` | Esquema y datos generados por `mariadb-dump` |
| `manifest.json` | Conteo y huella SHA-256 del contenido ordenado de cada base |
| `postgres.sha256` | Huella del archivo SQL de PostgreSQL |
| `mariadb.sha256` | Huella del archivo SQL de MariaDB |

Los clientes de los motores generan los SQL dentro de los contenedores y Compose copia los archivos. El SQL no pasa por una redirección de PowerShell, evitando cambios de codificación. Los archivos nativos pueden incluir metadatos generados por los clientes de las bases de datos.

El script trabaja en una carpeta provisional, comprueba que los archivos no estén vacíos y publica la carpeta final al completar la operación. Si detecta que los datos cambiaron durante el respaldo, termina con error y retira el resultado provisional. Durante la demostración, completa las ediciones antes de respaldar.

El respaldo de cada motor es independiente. No se implementa una transacción distribuida entre PostgreSQL y MariaDB. Las dos aplicaciones de ejemplo no tienen dependencias cruzadas entre sus registros.

## Verificar un respaldo

Por defecto se verifica el último respaldo. Para seleccionar otro, utiliza su ruta relativa:

```sh
make verificar-respaldo RESPALDO=respaldos/carpeta
```

La verificación:

1. Comprueba la presencia de los archivos y las huellas SHA-256 del SQL.
2. Crea dos bases temporales con nombres únicos.
3. Importa los SQL con los clientes de sus motores.
4. Consulta los datos restaurados y compara sus conteos y huellas con el manifiesto.
5. Elimina las bases y los archivos temporales, tanto al finalizar como al producirse un error.

La verificación no reemplaza las bases de la aplicación. Un archivo alterado, incompleto o que no pueda restaurarse produce un resultado fallido.

## Recuperar las bases de la aplicación

La restauración completa reemplaza los datos actuales. Antes de usarla, conserva un respaldo del estado que quieras mantener. Para recuperar el último respaldo:

```sh
make restaurar RESTAURAR=SI
```

Para elegir uno anterior:

```sh
make restaurar RESTAURAR=SI RESPALDO=respaldos/carpeta
```

Sin `RESTAURAR=SI`, la operación se rechaza. Primero se verifica el respaldo en bases temporales; después se detienen frontend y backend, se importan los archivos en las bases de demostración y se vuelven a iniciar los servicios. La restauración de los dos motores se realiza por separado. Si ocurre un fallo, revisa la salida y los registros antes de continuar.

## Persistencia

```sh
make detener
make iniciar
```

La parada normal conserva `datos_postgres` y `datos_mariadb`. El esquema se inicializa al crear cada volumen por primera vez. Reconstruir las imágenes no elimina esos volúmenes.

`docker compose down -v` elimina los datos del entorno. Úsalo solamente si deseas empezar de cero. Los respaldos guardados en la carpeta del equipo permanecen aunque elimines los volúmenes.
