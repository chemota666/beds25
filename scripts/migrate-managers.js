import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'roomflow',
  password: process.env.DB_PASSWORD || 'roomflow123',
  database: process.env.DB_NAME || 'roomflow_pms',
  waitForConnections: true,
  connectionLimit: 10,
});

const migrate = async () => {
  const conn = await pool.getConnection();
  try {
    console.log('Starting managers migration...');

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS managers (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        notes TEXT NULL,
        createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`);
      console.log('✓ managers table ready');
    } catch (err) {
      throw err;
    }

    try {
      await conn.query('ALTER TABLE `properties` ADD COLUMN managerId VARCHAR(50) NULL');
      console.log('✓ Added managerId to properties');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ managerId already exists in properties');
      } else {
        throw err;
      }
    }

    try {
      await conn.query('ALTER TABLE `reservations` ADD COLUMN cashDelivered TINYINT(1) NULL DEFAULT 0');
      console.log('✓ Added cashDelivered to reservations');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ cashDelivered already exists in reservations');
      } else {
        throw err;
      }
    }

    console.log('✓ Managers migration completed');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
};

migrate();
