set -eu
. "$(dirname "$0")/comun.sh"
source_dir=$(backup_path)
for file in postgres.sql mariadb.sql postgres.sha256 mariadb.sha256 manifest.json; do
  if [ ! -s "$source_dir/$file" ]; then printf 'Falta el archivo completo: %s/%s\n' "$source_dir" "$file" >&2; exit 1; fi
done
if [ "$(hash_file "$source_dir/postgres.sql")" != "$(cat "$source_dir/postgres.sha256")" ] || [ "$(hash_file "$source_dir/mariadb.sql")" != "$(cat "$source_dir/mariadb.sha256")" ]; then
  printf 'Los archivos SQL no coinciden con sus sumas SHA-256.\n' >&2
  exit 1
fi
token=$(date -u '+%Y%m%d%H%M%S')_$$
pg_db=verificacion_pg_$token
my_db=verificacion_my_$token
sql_file=/tmp/reto04-$token.sql
snapshot_file="$source_dir/.verificacion-$token.json"
pg_created=no
my_created=no
finish() {
  status=$?
  trap - 0 INT TERM
  if [ "$pg_created" = si ]; then
    if ! compose exec -T -e RESTORE_DB="$pg_db" postgres sh /operaciones/operar-postgres.sh eliminar; then status=1; fi
  fi
  if [ "$my_created" = si ]; then
    if ! compose exec -T -e RESTORE_DB="$my_db" mariadb sh /operaciones/operar-mariadb.sh eliminar; then status=1; fi
  fi
  if ! compose exec -T postgres rm -f "$sql_file"; then status=1; fi
  if ! compose exec -T mariadb rm -f "$sql_file"; then status=1; fi
  rm -f "$snapshot_file"
  exit "$status"
}
trap finish 0
trap 'exit 130' INT
trap 'exit 143' TERM
compose exec -T -e RESTORE_DB="$pg_db" postgres sh /operaciones/operar-postgres.sh crear
pg_created=si
compose exec -T -e RESTORE_DB="$my_db" mariadb sh /operaciones/operar-mariadb.sh crear
my_created=si
compose cp "$source_dir/postgres.sql" "postgres:$sql_file"
compose cp "$source_dir/mariadb.sql" "mariadb:$sql_file"
compose exec -T -e RESTORE_DB="$pg_db" -e SQL_FILE="$sql_file" postgres sh /operaciones/operar-postgres.sh restaurar
compose exec -T -e RESTORE_DB="$my_db" -e SQL_FILE="$sql_file" mariadb sh /operaciones/operar-mariadb.sh restaurar
compose exec -T -e POSTGRES_DB="$pg_db" -e MARIADB_DATABASE="$my_db" backend node scripts/snapshot.js > "$snapshot_file"
if ! cmp -s "$source_dir/manifest.json" "$snapshot_file"; then
  printf 'Los datos restaurados no coinciden con el manifiesto del respaldo.\n' >&2
  exit 1
fi
printf 'Respaldo verificado: ambos motores restaurados en bases temporales; conteos y SHA-256 coinciden.\n'
cat "$snapshot_file"
