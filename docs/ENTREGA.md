# Guía de entrega · Reto 4

**Integrantes: Sebastián y Santiago.**

## Qué se entrega

Un entorno de cuatro servicios independientes, coordinados con Make y Docker Compose. Nginx sirve una interfaz adaptable; Node.js expone la API; PostgreSQL almacena tareas y MariaDB almacena productos. La automatización ejecuta pruebas, siembra ejemplos sin duplicarlos y genera y verifica respaldos SQL.

| Entregable | Dónde encontrarlo |
| --- | --- |
| Contenedores y coordinación | `compose.yaml`, `backend/Dockerfile`, `frontend/Dockerfile` |
| Interfaz integrada | `frontend/public/` |
| Backend con ambos motores | `backend/src/` |
| Automatización avanzada | `Makefile`, `scripts/` y `backend/scripts/` |
| Esquemas y ejemplos | `db/postgres/`, `db/mariadb/` |
| Pruebas automáticas | `backend/test/` y `.github/workflows/verificacion.yml` |
| Instalación y operación | `README.md`, `docs/OPERACION.md`, `docs/WINDOWS.md` |
| Capturas y resultados | `docs/EVIDENCIAS.md` |

## Antes de presentar

1. Inicia Docker.
2. Ejecuta `make iniciar` o `docker compose up --build -d --wait`.
3. Comprueba los cuatro servicios saludables con `make estado` o `docker compose ps`.
4. Abre `http://localhost:3004`.
5. Ten disponible una terminal dentro del repositorio para mostrar los comandos de automatización.

## Guion de demostración, de cinco a siete minutos

1. **Orquestación.** Muestra el Makefile y ejecuta `make estado`. Identifica frontend, backend y los dos motores separados.
2. **Interfaz y datos reales.** Crea un producto, edita sus existencias y crea y completa una tarea. Explica qué motor almacena cada recurso. La página no se recarga.
3. **Pruebas.** Ejecuta `make probar`. Explica que la suite usa HTTP y ambas bases reales y limpia sus registros temporales.
4. **Sembrado.** Ejecuta `make sembrar` dos veces. Actualiza la interfaz y muestra que no aparecen ejemplos duplicados ni se pierden las modificaciones existentes.
5. **Respaldo.** Ejecuta `make respaldar`. Muestra los archivos `.sql` de PostgreSQL y MariaDB y los registros de verificación generados.
6. **Restauración comprobada.** Ejecuta `make verificar-respaldo`. Explica que restaura en bases temporales y compara los datos con el respaldo, conservando intactas las bases de la aplicación.
7. **Persistencia y adaptación.** Reduce el ancho de la ventana para mostrar la vista móvil. Si hay tiempo, detén con `make detener`, inicia otra vez y comprueba que los datos permanecen.

## Qué explicar del diseño

El Makefile ofrece una entrada única para las tareas repetitivas y mantiene el orden de las operaciones. Las comprobaciones de salud evitan iniciar la aplicación antes de que las bases estén listas. Los volúmenes conservan los datos entre ejecuciones y las redes internas evitan publicar puertos innecesarios.

El sembrado tiene claves estables para los ejemplos. Los respaldos contienen esquema y datos; la verificación restaura archivos SQL reales y comprueba su contenido. La interfaz muestra salud consultada y permite trabajar con los dos motores desde el mismo navegador.

El comando de parada normal conserva los volúmenes. Los respaldos se generan localmente y no se publican en Git. Consulta el manual de operación para las opciones de recuperación.

Ambos integrantes pueden presentar el funcionamiento completo y repartirse libremente la demostración.
