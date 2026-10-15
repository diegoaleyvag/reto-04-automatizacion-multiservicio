CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  CONSTRAINT stock_range CHECK (stock BETWEEN 0 AND 1000000),
  CONSTRAINT name_length CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 2 AND 100),
  CONSTRAINT code_format CHECK (code REGEXP '^[A-Z0-9-]{2,32}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT IGNORE INTO products (code, name, stock) VALUES
  ('TEC-001', 'Teclado mecánico', 24),
  ('MON-002', 'Monitor de 24 pulgadas', 12),
  ('USB-003', 'Memoria USB de 64 GB', 48);
