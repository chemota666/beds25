import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

interface MigrationResult {
  version: string;
  name: string;
  status: 'success' | 'failed' | 'rolled_back';
  executionTime: number;
  error?: string;
}

export class MigrationRunner {
  private connection: mysql.Connection;
  private migrationsDir: string;

  constructor(connection: mysql.Connection, migrationsDir: string = __dirname) {
    this.connection = connection;
    this.migrationsDir = migrationsDir;
  }

  async ensureMigrationTable(): Promise<void> {
    const createTableSQL = `
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
    `;
    await this.connection.query(createTableSQL);
  }

  async getExecutedMigrations(): Promise<string[]> {
    const [rows] = await this.connection.query<any[]>(
      'SELECT version FROM migration_history WHERE status = "success" ORDER BY version'
    );
    return rows.map(row => row.version);
  }

  async getPendingMigrations(): Promise<string[]> {
    const files = await fs.readdir(this.migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    const executed = await this.getExecutedMigrations();
    return sqlFiles.filter(f => !executed.includes(f));
  }

  async runMigration(fileName: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const filePath = path.join(this.migrationsDir, fileName);
    
    try {
      const sql = await fs.readFile(filePath, 'utf-8');
      
      // Ejecutar la migración dentro de una transacción
      await this.connection.beginTransaction();
      
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await this.connection.query(statement);
      }

      const executionTime = Date.now() - startTime;

      // Registrar la migración exitosa
      await this.connection.query(
        'INSERT INTO migration_history (version, name, execution_time_ms, status) VALUES (?, ?, ?, ?)',
        [fileName, fileName.replace('.sql', ''), executionTime, 'success']
      );

      await this.connection.commit();

      console.log(`✓ Migración ${fileName} ejecutada exitosamente en ${executionTime}ms`);

      return {
        version: fileName,
        name: fileName.replace('.sql', ''),
        status: 'success',
        executionTime
      };

    } catch (error: any) {
      await this.connection.rollback();
      const executionTime = Date.now() - startTime;
      const errorMessage = error.message || String(error);

      // Registrar el error
      await this.connection.query(
        'INSERT INTO migration_history (version, name, execution_time_ms, status, error_message) VALUES (?, ?, ?, ?, ?)',
        [fileName, fileName.replace('.sql', ''), executionTime, 'failed', errorMessage]
      );

      console.error(`✗ Error en migración ${fileName}:`, errorMessage);

      return {
        version: fileName,
        name: fileName.replace('.sql', ''),
        status: 'failed',
        executionTime,
        error: errorMessage
      };
    }
  }

  async runAllPending(): Promise<MigrationResult[]> {
    await this.ensureMigrationTable();
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('✓ No hay migraciones pendientes');
      return [];
    }

    console.log(`Ejecutando ${pending.length} migración(es) pendiente(s)...`);
    
    const results: MigrationResult[] = [];
    
    for (const migration of pending) {
      const result = await this.runMigration(migration);
      results.push(result);
      
      if (result.status === 'failed') {
        console.error('Deteniendo ejecución de migraciones debido a un error');
        break;
      }
    }

    return results;
  }
}
