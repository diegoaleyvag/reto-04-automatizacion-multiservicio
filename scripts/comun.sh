set -eu
COMPOSE=${COMPOSE:-docker compose}
if [ -n "${MSYSTEM:-}" ]; then
  export MSYS_NO_PATHCONV=1
  export MSYS2_ARG_CONV_EXCL='*'
fi
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
