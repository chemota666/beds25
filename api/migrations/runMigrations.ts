import mysql from 'mysql2/promise';
import { MigrationRunner } from './migrationRunner';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  let connection: mysql.Connection | null = null;

  try {
    console.log('=== Sistema de Migraciones RoomFlow PMS ===\n');
    console.log('Conectando a la base de datos...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'n8n-contabo.ddns.net',
      port: parseInt(process.env.DB_PORT || '3003'),
      user: process.env.DB_USER || 'roomflow_user',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'roomflow_pms',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos\n');

    const migrationsDir = __dirname;
    const runner = new MigrationRunner(connection, migrationsDir);

    console.log('Ejecutando migraciones pendientes...\n');
    const results = await runner.runAllPending();

    console.log('\n=== Resumen de Ejecución ===');
    console.log(`Total de migraciones ejecutadas: ${results.length}`);
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    console.log(`✓ Exitosas: ${successful.length}`);
    if (failed.length > 0) {
      console.log(`✗ Fallidas: ${failed.length}`);
      failed.forEach(f => {
        console.log(`  - ${f.name}: ${f.error}`);
      });
      process.exit(1);
    }

    console.log('\n✓ Todas las migraciones se ejecutaron exitosamente');

  } catch (error: any) {
    console.error('\n✗ Error fatal:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nConexión cerrada');
    }
  }
}

main();
