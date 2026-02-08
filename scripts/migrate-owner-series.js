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
    console.log('Starting owner invoice series migration...');

    // Ensure taxAddress column exists for owners
    try {
      await conn.query(`
        ALTER TABLE \`owners\`
        ADD COLUMN taxAddress VARCHAR(255) NULL
      `);
      console.log('✓ Added taxAddress to owners');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ taxAddress already exists in owners');
      } else {
        throw err;
      }
    }

    // Set invoiceSeries = id (as string) for all owners
    const [result] = await conn.query(`
      UPDATE \`owners\`
      SET invoiceSeries = CAST(id AS CHAR)
    `);

    const affected = result && typeof result.affectedRows === 'number' ? result.affectedRows : 0;
    console.log(`✓ Updated invoiceSeries for ${affected} owners`);

    console.log('✓ Owner invoice series migration completed');
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
