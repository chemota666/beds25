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
    console.log('Starting invoice schema migration...');

    // Step 1: Add invoiceDate column to reservations if missing
    try {
      await conn.query(`
        ALTER TABLE \`reservations\` 
        ADD COLUMN invoiceDate DATE NULL 
        AFTER invoiceNumber
      `);
      console.log('✓ Added invoiceDate column to reservations');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate column')) {
        console.log('✓ invoiceDate column already exists in reservations');
      } else {
        throw err;
      }
    }

    // Step 2: Add lastInvoiceNumber column to owners if missing
    try {
      await conn.query(`
        ALTER TABLE \`owners\` 
        ADD COLUMN lastInvoiceNumber INT DEFAULT 0 
        AFTER invoiceSeries
      `);
      console.log('✓ Added lastInvoiceNumber column to owners');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate column')) {
        console.log('✓ lastInvoiceNumber column already exists in owners');
      } else {
        throw err;
      }
    }

    // Step 3: Create invoices table if missing
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`invoices\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          \`number\` VARCHAR(20) NOT NULL UNIQUE,
          reservationId INT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reservationId) REFERENCES \`reservations\`(id) ON DELETE CASCADE,
          INDEX idx_number (\`number\`),
          INDEX idx_reservationId (reservationId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✓ Created invoices table');
    } catch (err) {
      if (err && err.message && err.message.includes('already exists')) {
        console.log('✓ invoices table already exists');
      } else {
        throw err;
      }
    }

    // Step 3b: Ensure invoices.number exists if table was created previously with wrong schema
    try {
      await conn.query(`
        ALTER TABLE \`invoices\`
        ADD COLUMN \`number\` VARCHAR(20) NOT NULL UNIQUE
      `);
      console.log('✓ Added number column to invoices');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate column')) {
        console.log('✓ number column already exists in invoices');
      } else {
        // If table doesn't exist or other error, rethrow
        if (err && err.message && err.message.includes('doesn\'t exist')) throw err;
        if (err && err.code === 'ER_DUP_FIELDNAME') {
          console.log('✓ number column already exists in invoices');
        } else if (err && err.message && err.message.includes('Duplicate key name')) {
          console.log('✓ number unique index already exists in invoices');
        } else if (err && err.message && err.message.includes('Unknown column')) {
          throw err;
        }
      }
    }

    // Step 3c: Ensure indexes exist
    try {
      await conn.query('CREATE INDEX idx_number ON `invoices` (`number`)');
      console.log('✓ Added idx_number index to invoices');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate key name')) {
        console.log('✓ idx_number index already exists in invoices');
      }
    }

    try {
      await conn.query('CREATE INDEX idx_reservationId ON `invoices` (reservationId)');
      console.log('✓ Added idx_reservationId index to invoices');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate key name')) {
        console.log('✓ idx_reservationId index already exists in invoices');
      }
    }

    // Step 4: Add invoiceNumber column to reservations if missing
    try {
      await conn.query(`
        ALTER TABLE \`reservations\` 
        ADD COLUMN invoiceNumber VARCHAR(20) NULL UNIQUE 
        AFTER paymentMethod
      `);
      console.log('✓ Added invoiceNumber column to reservations');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate column')) {
        console.log('✓ invoiceNumber column already exists in reservations');
      } else {
        throw err;
      }
    }

    // Step 5: Add invoiceSeries column to owners if missing
    try {
      await conn.query(`
        ALTER TABLE \`owners\` 
        ADD COLUMN invoiceSeries VARCHAR(10) NULL 
        AFTER phone
      `);
      console.log('✓ Added invoiceSeries column to owners');
    } catch (err) {
      if (err && err.message && err.message.includes('Duplicate column')) {
        console.log('✓ invoiceSeries column already exists in owners');
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
