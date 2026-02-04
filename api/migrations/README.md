# Sistema de Migraciones RoomFlow PMS

## Descripción

Este sistema gestiona los cambios en el esquema de la base de datos de forma controlada y versionada.

## Estructura

- `migration_history` - Tabla que registra todas las migraciones ejecutadas
- `XXX_nombre_migracion.sql` - Archivos SQL con las migraciones
- `migrationRunner.ts` - Clase para ejecutar migraciones
- `runMigrations.cjs` - Script CLI para ejecutar migraciones pendientes

## Tabla migration_history

```sql
CREATE TABLE migration_history (
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
) ENGINE=InnoDB;
```

## Cómo crear una nueva migración

1. Crear archivo con nomenclatura: `XXX_descripcion.sql` donde XXX es número secuencial
2. Escribir el SQL de la migración con comentarios descriptivos
3. Ejemplo:

```sql
-- Migración 003: Añadir campo email a tabla owners
-- Fecha: 2025-02-04
-- Descripción: Se agrega campo email para notificaciones

ALTER TABLE owners ADD COLUMN email VARCHAR(255) AFTER name;
ALTER TABLE owners ADD INDEX idx_email (email);
```

## Ejecutar migraciones

### En el servidor (Contabo)

```bash
cd /opt/apps/roomflow-staging/migrations
mysql -u roomflow -proomflow123 roomflow_pms < XXX_migration.sql
mysql -u roomflow -proomflow123 roomflow_pms -e "INSERT INTO migration_history (version, name, execution_time_ms, status) VALUES ('XXX_migration.sql', 'XXX_migration', 0, 'success');"
```

### Desde Codespace (Node.js)

```bash
node api/migrations/runMigrations.cjs
```

## Migraciones existentes

- `001_create_migration_history.sql` - Crea tabla migration_history
- `002_baseline_schema_snapshot.sql` - Snapshot inicial del esquema

## Rollback

El sistema incluye rollback automático mediante transacciones. Si una migración falla, todos los cambios se revierten automáticamente.

## Mejores prácticas

1. **Probar migraciones localmente** antes de ejecutar en producción
2. **Una migración = un cambio** - No mezclar múltiples cambios no relacionados
3. **Migraciones incrementales** - Dividir cambios grandes en pasos pequeños
4. **Documentar bien** - Comentar el propósito y contexto
5. **Backup antes de migrar** - Siempre hacer backup de la BD antes de cambios importantes

## Verificar estado

```sql
-- Ver migraciones ejecutadas
SELECT * FROM migration_history ORDER BY executed_at DESC;

-- Ver migraciones pendientes (comparar con archivos en disco)
SELECT version FROM migration_history WHERE status = 'success';
```
