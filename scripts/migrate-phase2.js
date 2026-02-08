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
    console.log('Starting PHASE 2 schema migration...');

    // Step 1: Add fields to guests if missing
    try {
      await conn.query(`
        ALTER TABLE \`guests\` 
        ADD COLUMN bankAccount VARCHAR(50) NULL,
        ADD COLUMN bankName VARCHAR(100) NULL
      `);
      console.log('✓ Added bank fields to guests');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ Bank fields already exist in guests');
      } else {
        throw err;
      }
    }

    // Step 2: Add fields to owners if missing
    try {
      await conn.query(`
        ALTER TABLE \`owners\` 
        ADD COLUMN bankAccount VARCHAR(50) NULL,
        ADD COLUMN bankName VARCHAR(100) NULL,
        ADD COLUMN taxId VARCHAR(20) NULL,
        ADD COLUMN commission DECIMAL(5,2) DEFAULT 0
      `);
      console.log('✓ Added bank and commission fields to owners');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ Bank and commission fields already exist in owners');
      } else {
        throw err;
      }
    }

    // Step 3: Create documents table
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`documents\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          documentType VARCHAR(50) NOT NULL,
          fileName VARCHAR(255) NOT NULL,
          filePath VARCHAR(255) NOT NULL,
          fileSize INT DEFAULT 0,
          mimeType VARCHAR(100),
          uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_userId (userId),
          INDEX idx_documentType (documentType),
          INDEX idx_uploadedAt (uploadedAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created documents table');
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log('✓ documents table already exists');
      } else {
        throw err;
      }
    }

    // Step 4: Add overbook validation fields to reservations if missing
    try {
      await conn.query(`
        ALTER TABLE \`reservations\` 
        ADD COLUMN status VARCHAR(20) DEFAULT 'confirmed'
      `);
      console.log('✓ Added status field to reservations');
    } catch (err) {
      if (err.message && err.message.includes('Duplicate column')) {
        console.log('✓ status field already exists in reservations');
      } else {
        throw err;
      }
    }

    console.log('✓ PHASE 2 migration completed successfully');
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
