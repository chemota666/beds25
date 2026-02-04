const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  let connection = null;

  try {
    console.log('=== Sistema de Migraciones RoomFlow PMS ===\n');
    console.log('Conectando a la base de datos...');
    
    // Usar localhost porque el proxy HTTP redirige las peticiones
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'roomflow',
      password: 'roomflow123',
      database: 'roomflow_pms',
      multipleStatements: true
    });

    console.log('\u2713 Conectado a la base de datos\n');

    // Leer el archivo SQL de la primera migración
    const sqlPath = path.join(__dirname, '001_create_migration_history.sql');
    const sql = await fs.readFile(sqlPath, 'utf-8');

    console.log('Ejecutando migración 001_create_migration_history.sql...');
    
    await connection.query(sql);

    console.log('\u2713 Tabla migration_history creada exitosamente\n');

    // Registrar la migración
    await connection.query(
      'INSERT INTO migration_history (version, name, execution_time_ms, status) VALUES (?, ?, ?, ?)',
      ['001_create_migration_history.sql', '001_create_migration_history', 0, 'success']
    );

    console.log('\u2713 Migración registrada en migration_history');

    // Verificar
    const [rows] = await connection.query('SELECT * FROM migration_history');
    console.log('\nRegistros en migration_history:');
    console.log(rows);

  } catch (error) {
    console.error('\n\u2717 Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nConexión cerrada');
    }
  }
}

main();
