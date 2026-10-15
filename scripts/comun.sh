set -eu
COMPOSE=${COMPOSE:-docker compose}
compose() {
  $COMPOSE "$@"
}
hash_file() {
  compose exec -T backend node --input-type=module -e 'import {createHash} from "node:crypto"; const h=createHash("sha256"); for await (const c of process.stdin) h.update(c); console.log(h.digest("hex"));' < "$1"
}
backup_path() {
  if [ -n "${RESPALDO:-}" ]; then
    printf '%s\n' "$RESPALDO"
  elif [ -s respaldos/ultimo ]; then
    cat respaldos/ultimo
  else
    printf 'No hay respaldos. Ejecuta make respaldar primero.\n' >&2
    return 1
  fi
}
