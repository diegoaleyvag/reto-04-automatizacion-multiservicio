set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
action=${1:?Falta la operación}
case "${RESTORE_DB:-}" in
  "$POSTGRES_DB")
    if [ "${RESTAURAR:-}" != SI ]; then
      printf 'La restauración de la base de demostración requiere RESTAURAR=SI.\n' >&2
      exit 1
    fi
    ;;
  verificacion_[a-z0-9_]*) ;;
  *) printf 'El nombre de la base de restauración no está permitido.\n' >&2; exit 1 ;;
esac
case "$RESTORE_DB" in *[!a-zA-Z0-9_]*) printf 'Nombre de base inválido.\n' >&2; exit 1 ;; esac
case "$action" in
  crear) createdb --username="$POSTGRES_USER" --template=template0 "$RESTORE_DB" ;;
  restaurar)
    test -s "${SQL_FILE:?Falta el archivo SQL}"
    psql --username="$POSTGRES_USER" --dbname="$RESTORE_DB" --set=ON_ERROR_STOP=1 --file="$SQL_FILE" > /dev/null
    ;;
  eliminar)
    case "$RESTORE_DB" in verificacion_*) dropdb --username="$POSTGRES_USER" --if-exists "$RESTORE_DB" ;; *) exit 1 ;; esac
    ;;
  *) printf 'Operación PostgreSQL desconocida.\n' >&2; exit 1 ;;
esac
