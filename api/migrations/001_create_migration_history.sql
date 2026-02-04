-- Migración 001: Crear tabla de historial de migraciones
-- Fecha: 2025
-- Descripción: Esta tabla almacena el historial de todas las migraciones ejecutadas

CREATE TABLE IF NOT EXISTS migration_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INT,
  status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',
  error_message TEXT,
  rollback_script TEXT,
  INDEX idx_version (version),
  INDEX idx_executed_at (executed_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
