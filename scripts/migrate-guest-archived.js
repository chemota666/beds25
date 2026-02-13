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
    console.log('Starting guest archived migration...');

    try {
      await conn.query(`
        ALTER TABLE \`guests\`
        ADD COLUMN archived TINYINT(1) DEFAULT 0
      `);
      console.log('✓ Added archived column to guests');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ archived column already exists in guests');
      } else {
        throw err;
      }
    }

    console.log('✓ Migration completed successfully');
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
