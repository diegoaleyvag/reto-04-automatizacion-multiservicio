set -eu
. "$(dirname "$0")/comun.sh"
if [ "${RESTAURAR:-}" != SI ]; then
  printf 'Esta operación reemplaza los datos actuales. Usa make restaurar RESTAURAR=SI RESPALDO=respaldos/carpeta para autorizarla.\n' >&2
  exit 1
fi
source_dir=$(backup_path)
RESPALDO="$source_dir" sh "$(dirname "$0")/verificar-respaldo.sh"
restart_needed=no
finish() {
  status=$?
  trap - 0 INT TERM
  if [ "$restart_needed" = si ]; then
    if ! compose up -d --wait backend frontend; then status=1; fi
  fi
  if [ "$status" -ne 0 ]; then printf 'La restauración falló. Revisa los registros antes de continuar.\n' >&2; fi
  exit "$status"
}
trap finish 0
trap 'exit 130' INT
trap 'exit 143' TERM
restart_needed=si
compose stop frontend backend
compose cp "$source_dir/postgres.sql" postgres:/tmp/reto04-restaurar.sql
compose cp "$source_dir/mariadb.sql" mariadb:/tmp/reto04-restaurar.sql
compose exec -T -e RESTAURAR=SI postgres sh -c 'RESTORE_DB="$POSTGRES_DB" SQL_FILE=/tmp/reto04-restaurar.sql sh /operaciones/operar-postgres.sh restaurar'
compose exec -T -e RESTAURAR=SI mariadb sh -c 'RESTORE_DB="$MARIADB_DATABASE" SQL_FILE=/tmp/reto04-restaurar.sql sh /operaciones/operar-mariadb.sh restaurar'
compose exec -T postgres rm /tmp/reto04-restaurar.sql
compose exec -T mariadb rm /tmp/reto04-restaurar.sql
printf 'Datos restaurados desde %s.\n' "$source_dir"
