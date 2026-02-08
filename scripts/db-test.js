import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function testConnection() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'roomflow',
    password: process.env.DB_PASSWORD || 'roomflow123',
    database: process.env.DB_NAME || undefined,
    connectTimeout: 5000
  };

  console.log('Attempting MySQL connection to', `${config.host}:${config.port}`);
  try {
    const conn = await mysql.createConnection(config);
    await conn.ping();
    console.log('MySQL connection successful');
    await conn.end();
  } catch (err) {
    console.error('MySQL connection failed:');
    console.error(err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

testConnection();
