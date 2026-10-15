set -eu
export MYSQL_PWD="$MARIADB_PASSWORD"
mariadb-dump --user="$MARIADB_USER" --single-transaction --routines --triggers --events --default-character-set=utf8mb4 "$MARIADB_DATABASE" > /tmp/reto04-mariadb.sql.part
test -s /tmp/reto04-mariadb.sql.part
mv /tmp/reto04-mariadb.sql.part /tmp/reto04-mariadb.sql
printf 'Respaldo MariaDB generado.\n'
