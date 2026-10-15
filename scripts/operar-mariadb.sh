set -eu
export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"
action=${1:?Falta la operación}
case "${RESTORE_DB:-}" in
  "$MARIADB_DATABASE")
    if [ "${RESTAURAR:-}" != SI ]; then
      printf 'La restauración de la base de demostración requiere RESTAURAR=SI.\n' >&2
      exit 1
    fi
    ;;
  verificacion_[a-z0-9_]*) ;;
  *) printf 'El nombre de la base de restauración no está permitido.\n' >&2; exit 1 ;;
esac
case "$RESTORE_DB" in *[!a-zA-Z0-9_]*) printf 'Nombre de base inválido.\n' >&2; exit 1 ;; esac
case "$MARIADB_USER" in *[!a-zA-Z0-9_]*) printf 'Nombre de usuario inválido.\n' >&2; exit 1 ;; esac
case "$action" in
  crear)
    mariadb --user=root --execute="CREATE DATABASE \`$RESTORE_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT SELECT ON \`$RESTORE_DB\`.* TO '$MARIADB_USER'@'%';"
    ;;
  restaurar)
    test -s "${SQL_FILE:?Falta el archivo SQL}"
    mariadb --user=root --default-character-set=utf8mb4 "$RESTORE_DB" < "$SQL_FILE"
    ;;
  eliminar)
    case "$RESTORE_DB" in verificacion_*) mariadb --user=root --execute="DROP DATABASE IF EXISTS \`$RESTORE_DB\`;" ;; *) exit 1 ;; esac
    ;;
  *) printf 'Operación MariaDB desconocida.\n' >&2; exit 1 ;;
esac
