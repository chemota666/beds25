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
    console.log('Starting reservation receipt migration...');

    try {
      await conn.query('ALTER TABLE `reservations` ADD COLUMN paymentReceiptFile VARCHAR(255) NULL');
      console.log('✓ Added paymentReceiptFile to reservations');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ paymentReceiptFile already exists in reservations');
      } else {
        throw err;
      }
    }

    console.log('✓ Reservation receipt migration completed');
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
