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

const cleanup = async () => {
  const conn = await pool.getConnection();
  try {
    const [props] = await conn.query('SELECT id FROM `properties`');
    const propIds = new Set((props || []).map(p => String(p.id)));

    const [rooms] = await conn.query('SELECT id, propertyId, name FROM `rooms`');
    const orphanRooms = (rooms || []).filter(r => !propIds.has(String(r.propertyId)));

    if (!orphanRooms.length) {
      console.log('No orphan rooms found.');
      process.exit(0);
    }

    const orphanIds = orphanRooms.map(r => r.id);
    const placeholders = orphanIds.map(() => '?').join(',');
    const [resRows] = await conn.query(
      `SELECT DISTINCT roomId FROM \`reservations\` WHERE roomId IN (${placeholders})`,
      orphanIds
    );
    const roomsWithRes = new Set((resRows || []).map(r => String(r.roomId)));

    const deletable = orphanRooms.filter(r => !roomsWithRes.has(String(r.id)));

    if (!deletable.length) {
      console.log('Orphan rooms found but all have reservations. No deletions performed.');
      process.exit(0);
    }

    const deletableIds = deletable.map(r => r.id);
    const deletePlaceholders = deletableIds.map(() => '?').join(',');
    await conn.query(
      `DELETE FROM \`rooms\` WHERE id IN (${deletePlaceholders})`,
      deletableIds
    );

    console.log(`Deleted ${deletableIds.length} orphan rooms:`, deletable.map(r => `${r.id} (${r.name})`).join(', '));
  } catch (err) {
    console.error('Cleanup error:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
};

cleanup();
