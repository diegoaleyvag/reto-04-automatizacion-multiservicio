set -eu
. "$(dirname "$0")/comun.sh"
mkdir -p respaldos
stamp=$(date -u '+%Y%m%dT%H%M%SZ')-$$
staging="respaldos/.pendiente-$stamp"
destination="respaldos/$stamp"
mkdir "$staging"
finish() {
  status=$?
  trap - 0 INT TERM
  if [ -d "$staging" ]; then rm -rf "$staging"; fi
  exit "$status"
}
trap finish 0
trap 'exit 130' INT
trap 'exit 143' TERM
compose exec -T backend node scripts/snapshot.js > "$staging/manifest.json"
compose exec -T postgres sh /operaciones/backup-postgres.sh
compose exec -T mariadb sh /operaciones/backup-mariadb.sh
compose cp postgres:/tmp/reto04-postgres.sql "$staging/postgres.sql"
compose cp mariadb:/tmp/reto04-mariadb.sql "$staging/mariadb.sql"
test -s "$staging/postgres.sql"
test -s "$staging/mariadb.sql"
compose exec -T backend node scripts/snapshot.js > "$staging/estado-final.json"
if ! cmp -s "$staging/manifest.json" "$staging/estado-final.json"; then
  printf 'Los datos cambiaron durante el respaldo. Detén las escrituras y vuelve a ejecutarlo.\n' >&2
  exit 1
fi
rm "$staging/estado-final.json"
hash_file "$staging/postgres.sql" > "$staging/postgres.sha256"
hash_file "$staging/mariadb.sql" > "$staging/mariadb.sha256"
mv "$staging" "$destination"
printf '%s\n' "$destination" > respaldos/ultimo
printf 'Respaldo completo: %s\n' "$destination"
