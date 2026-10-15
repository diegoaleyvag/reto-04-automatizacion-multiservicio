set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --file=/tmp/reto04-postgres.sql.part
test -s /tmp/reto04-postgres.sql.part
mv /tmp/reto04-postgres.sql.part /tmp/reto04-postgres.sql
printf 'Respaldo PostgreSQL generado.\n'
