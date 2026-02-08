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

const reset = async () => {
  const conn = await pool.getConnection();
  try {
    console.log('Resetting invoices and counters...');
    await conn.beginTransaction();

    await conn.query('UPDATE `reservations` SET invoiceNumber = NULL, invoiceDate = NULL');
    await conn.query('DELETE FROM `invoices`');
    await conn.query('UPDATE `owners` SET lastInvoiceNumber = 0');

    await conn.commit();
    console.log('✓ Invoice numbers cleared, invoices deleted, counters reset');
    process.exit(0);
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Reset error:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
};

reset();
