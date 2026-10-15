# Uso en Windows

**Integrantes: Sebastián y Santiago.**

## Iniciar desde PowerShell

1. Instala y abre Docker Desktop, con contenedores Linux.
2. Descarga y descomprime el proyecto.
3. Abre PowerShell en la carpeta que contiene `compose.yaml`.
4. Ejecuta:

```powershell
docker compose up --build -d --wait --wait-timeout 180
docker compose ps
```

Abre `http://localhost:3004`. No necesitas instalar Node.js, Nginx, PostgreSQL ni MariaDB.

## Pruebas y sembrado sin Make

```powershell
docker compose exec -T backend npm test
docker compose exec -T backend npm run seed
```

Para detener conservando los datos:

```powershell
docker compose down
```

## Respaldo completo sin Make

Usa Git Bash, incluido en Git para Windows. Abre Git Bash en la carpeta del proyecto y ejecuta:

```sh
sh scripts/respaldar.sh
sh scripts/verificar-respaldo.sh
```

Se generan los SQL, el manifiesto y las huellas en `respaldos/`. Los scripts desactivan la conversión automática de rutas de Git Bash para mantener intactas las rutas internas de los contenedores. Utiliza rutas relativas al elegir un respaldo.

Los scripts se invocan con `sh`, por lo que no necesitan permisos de ejecución especiales. `.gitattributes` fija finales de línea LF para conservar su compatibilidad al clonar con Git en Windows. No cambies los scripts a formato CRLF.

## Usar el Makefile completo

Puedes usar GNU Make desde WSL con la integración de Docker Desktop habilitada para tu distribución. En la terminal de WSL, dentro de la carpeta del proyecto:

```sh
make iniciar
make probar
make sembrar
make respaldar
make verificar-respaldo
```

Si tu distribución no incluye GNU Make, instálalo con su gestor de paquetes. Git Bash también puede usar el Makefile si ya cuenta con GNU Make; la instalación habitual de Git para Windows no lo incluye.

## Puerto ocupado

Crea `.env` con el contenido siguiente:

```text
APP_PORT=3104
```

Vuelve a iniciar y abre `http://localhost:3104`.

## Referencia de compatibilidad

La configuración de rutas sigue las recomendaciones de [Docker Desktop para comandos desde Git Bash](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/) y [MSYS2 sobre conversión de argumentos](https://www.msys2.org/docs/filesystem-paths/). Las evidencias de ejecución disponibles se detallan en [EVIDENCIAS.md](EVIDENCIAS.md).
