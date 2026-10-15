CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(160) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  seed_key VARCHAR(32) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO tasks (title, completed, seed_key) VALUES
  ('Revisar el inventario de la semana', FALSE, 'inventario'),
  ('Preparar el respaldo de las bases', FALSE, 'respaldo'),
  ('Comprobar los cuatro servicios', TRUE, 'servicios')
ON CONFLICT (seed_key) DO NOTHING;
