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
    console.log('Starting incidents migration...');

    await conn.query(
      "CREATE TABLE IF NOT EXISTS `incidents` (" +
        "id INT AUTO_INCREMENT PRIMARY KEY," +
        "propertyId INT NOT NULL," +
        "title VARCHAR(255) NOT NULL," +
        "solved TINYINT(1) DEFAULT 0," +
        "refactured TINYINT(1) DEFAULT 0," +
        "`lines` LONGTEXT NULL," +
        "total DECIMAL(10,2) DEFAULT 0," +
        "createdAt DATE NULL," +
        "updatedAt DATE NULL," +
        "INDEX idx_propertyId (propertyId)," +
        "INDEX idx_solved (solved)," +
        "INDEX idx_refactured (refactured)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    console.log('✓ Incidents table ready');
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
