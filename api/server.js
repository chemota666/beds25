import fs from 'fs';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Create and manage a pool with automatic reconnection and keep-alive pings.
let pool = null;
const createPool = () => {
  const p = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'roomflow',
    password: process.env.DB_PASSWORD || 'roomflow123',
    database: process.env.DB_NAME || 'roomflow_pms',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONN_LIMIT || '10', 10),
    // small timeout to detect dead sockets faster
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10)
  });
  console.log('Created MySQL pool');
  return p;
};

const testPool = async (p) => {
  if (!p) return false;
  try {
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (err) {
    return false;
  }
};

const ensurePool = async (retries = 3, delayMs = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      if (!pool) pool = createPool();
      const ok = await testPool(pool);
      if (ok) return;
      // if not ok, destroy and recreate
      try { await pool.end(); } catch (_) {}
      pool = null;
      pool = createPool();
    } catch (err) {
      console.error('ensurePool attempt failed:', err && err.message ? err.message : err);
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  console.error('Could not establish MySQL pool after retries');
};

// Initialize pool immediately
pool = createPool();
ensurePool().then(() => {
  console.log('MySQL pool ready');
}).catch(err => {
  console.error('Pool init error:', err);
});

// Cache table columns to avoid unknown column errors on insert/update
const tableColumnsCache = new Map();

const getTableColumns = async (table) => {
  if (tableColumnsCache.has(table)) return tableColumnsCache.get(table);
  if (!pool) await ensurePool();
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  const cols = Array.isArray(rows) ? rows.map(r => r.Field) : [];
  tableColumnsCache.set(table, cols);
  return cols;
};

const filterDataByColumns = async (table, data) => {
  let cols = await getTableColumns(table);
  let filtered = Object.fromEntries(Object.entries(data).filter(([key]) => cols.includes(key)));
  if (Object.keys(filtered).length < Object.keys(data).length && tableColumnsCache.has(table)) {
    tableColumnsCache.delete(table);
    cols = await getTableColumns(table);
    filtered = Object.fromEntries(Object.entries(data).filter(([key]) => cols.includes(key)));
  }
  return filtered;
};

// Periodic keep-alive ping to avoid idle disconnects (adjust interval as needed)
const KEEP_ALIVE_MS = parseInt(process.env.DB_KEEP_ALIVE_MS || String(60 * 1000), 10);
setInterval(async () => {
  try {
    if (!pool) {
      await ensurePool(2, 1000);
      return;
    }
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
  } catch (err) {
    console.warn('Keep-alive ping failed, attempting to recreate pool:', err && err.message ? err.message : err);
    try { await pool.end(); } catch (_) {}
    pool = null;
    await ensurePool(3, 2000);
  }
}, KEEP_ALIVE_MS);

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down API server, closing MySQL pool...');
  try {
    if (pool) await pool.end();
  } catch (err) {
    console.error('Error closing pool:', err && err.message ? err.message : err);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Map booking fields (amount -> price)
function mapBookingFields(data) {
  const mapped = { ...data };
  if (mapped.amount !== undefined) {
    mapped.price = mapped.amount;
    delete mapped.amount;
  }
  return mapped;
}

// Helper function to format ISO dates to MySQL DATE format
const DATE_FIELDS = ['startDate', 'endDate', 'checkIn', 'checkOut', 'issueDate', 'dueDate', 'paidDate', 'soldDate', 'invoiceDate', 'createdAt', 'updatedAt'];

function formatDateFields(data) {
  const result = { ...data };
  DATE_FIELDS.forEach(field => {
    if (result[field]) {
      const date = new Date(result[field]);
      if (!isNaN(date.getTime())) {
        result[field] = date.toISOString().split('T')[0];
      }
    }
  });
  return result;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function syncRoomsForProperty(propertyId, numRooms) {
  const target = Number(numRooms) || 0;
  if (!propertyId) return;
  if (!pool) await ensurePool();

  const [rows] = await pool.query('SELECT id FROM `rooms` WHERE propertyId = ?', [propertyId]);
  const propRooms = Array.isArray(rows) ? rows : [];
  const existingCount = propRooms.length;

  if (target > existingCount) {
    for (let i = existingCount + 1; i <= target; i++) {
      const roomName = `Habitación ${i}`;
      await pool.query('INSERT INTO `rooms` (propertyId, name) VALUES (?, ?)', [propertyId, roomName]);
    }
  } else if (target < existingCount) {
    const sorted = propRooms.slice().sort((a, b) => Number(a.id) - Number(b.id));
    const toRemove = sorted.slice(target);
    for (const r of toRemove) {
      try { await pool.query('DELETE FROM `rooms` WHERE id = ?', [r.id]); } catch (_) {}
    }
  }
}

function normalizeRowDates(row) {
  const normalized = { ...row };
  DATE_FIELDS.forEach(field => {
    const value = normalized[field];
    if (!value) return;
    if (value instanceof Date) {
      normalized[field] = formatLocalDate(value);
      return;
    }
    if (typeof value === 'string' && value.includes('T')) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        normalized[field] = formatLocalDate(parsed);
      }
    }
  });
  return normalized;
}

app.get('/:table', async (req, res) => {
  try {
    // Ensure pool exists and is ready
    if (!pool) await ensurePool();
    const [rows] = await pool.query(`SELECT * FROM \`${req.params.table}\``);
    const normalized = Array.isArray(rows) ? rows.map(normalizeRowDates) : rows;
    res.json(normalized);
  } catch (err) {
    console.error('GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/:table', async (req, res) => {
  try {
    console.log('POST body:', JSON.stringify(req.body));
    let data = formatDateFields({ ...req.body });
    // Map booking fields for reservations
    if (req.params.table === 'reservations' || req.params.table === 'bookings') {
      data = mapBookingFields(data);
    }
    // Remove id if it's a temp id
    if (data.id && String(data.id).startsWith('temp_')) {
      delete data.id;
    }
    data = await filterDataByColumns(req.params.table, data);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to insert.' });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${req.params.table}\` (${keys.map(k => '\`'+k+'\`').join(', ')}) VALUES (${placeholders})`;
    console.log('SQL:', sql);
    if (!pool) await ensurePool();
    const [result] = await pool.query(sql, values);
    const inserted = { ...data, id: result.insertId };
    if (req.params.table === 'properties') {
      try {
        await syncRoomsForProperty(String(result.insertId), data.numRooms);
      } catch (e) {
        console.warn('Room sync failed on property create:', e && e.message ? e.message : e);
      }
    }
    res.json(inserted);
  } catch (err) {
    console.error('POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/:table/:id', async (req, res) => {
  try {
    let data = formatDateFields({ ...req.body });
    // Map booking fields for reservations
    if (req.params.table === 'reservations' || req.params.table === 'bookings') {
      data = mapBookingFields(data);
    }
    delete data.id;
    data = await filterDataByColumns(req.params.table, data);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => '\`'+k+'\` = ?').join(', ');
    if (!pool) await ensurePool();
    await pool.query(`UPDATE \`${req.params.table}\` SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
    if (req.params.table === 'properties') {
      try {
        await syncRoomsForProperty(String(req.params.id), data.numRooms);
      } catch (e) {
        console.warn('Room sync failed on property update:', e && e.message ? e.message : e);
      }
    }
    res.json({ ...req.body, id: parseInt(req.params.id) });
  } catch (err) {
    console.error('PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/:table/:id', async (req, res) => {
  try {
    if (!pool) await ensurePool();

    // Prevent deleting guests with reservations or invoices
    if (req.params.table === 'guests') {
      try {
        const [countRows] = await pool.query(
          'SELECT COUNT(*) AS cnt FROM `reservations` WHERE guestId = ? AND (invoiceNumber IS NULL OR invoiceNumber = "")',
          [req.params.id]
        );
        const [invoiceRows] = await pool.query(
          'SELECT COUNT(*) AS cnt FROM `reservations` WHERE guestId = ? AND (invoiceNumber IS NOT NULL AND invoiceNumber <> "")',
          [req.params.id]
        );
        const pendingCnt = countRows && countRows[0] ? Number(countRows[0].cnt) : 0;
        const invoicedCnt = invoiceRows && invoiceRows[0] ? Number(invoiceRows[0].cnt) : 0;
        if (pendingCnt > 0 || invoicedCnt > 0) {
          return res.status(400).json({ error: 'No se puede eliminar un huésped con reservas. Primero elimina reservas y facturas.' });
        }
      } catch (e) {
        console.error('Error checking guest reservations before delete:', e && e.message ? e.message : e);
      }
    }
    // Prevent deletion of invoiced reservations at API level
    if (req.params.table === 'reservations') {
      // Debugging: log the reservation row before attempting deletion
      try {
        const [rows] = await pool.query('SELECT id, invoiceNumber FROM `reservations` WHERE id = ?', [req.params.id]);
        const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM `reservations` WHERE id = ? AND (invoiceNumber IS NOT NULL AND invoiceNumber <> "")', [req.params.id]);
        const cnt = countRows && countRows[0] && countRows[0].cnt ? Number(countRows[0].cnt) : 0;
        const logLine = `${new Date().toISOString()} DELETE_CHECK id=${req.params.id} row=${JSON.stringify(rows[0]||{})} cnt=${cnt}\n`;
        try {
          const logDir = path.join(__dirname_upload, '..', 'logs');
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          fs.appendFileSync(path.join(logDir, 'delete.log'), logLine);
        } catch (wf) {
          console.error('Failed to write delete log:', wf && wf.message ? wf.message : wf);
        }
        if (cnt > 0) {
          return res.status(400).json({ error: 'No se puede eliminar una reserva que ya tiene factura.' });
        }
      } catch (e) {
        console.error('Error checking reservation before delete:', e && e.message ? e.message : e);
      }
    }
    await pool.query(`DELETE FROM \`${req.params.table}\` WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// File upload routes for owner documents
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename_upload = fileURLToPath(import.meta.url);
const __dirname_upload = path.dirname(__filename_upload);
const uploadDir = path.join(__dirname_upload, '..', 'uploads', 'owners');
const guestUploadDir = path.join(__dirname_upload, '..', 'uploads', 'guests');
const reservationUploadDir = path.join(__dirname_upload, '..', 'uploads', 'reservations');
const incidentUploadDir = path.join(__dirname_upload, '..', 'uploads', 'incidents');
const propertyUploadDir = path.join(__dirname_upload, '..', 'uploads', 'properties');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(guestUploadDir)) {
  fs.mkdirSync(guestUploadDir, { recursive: true });
}
if (!fs.existsSync(reservationUploadDir)) {
  fs.mkdirSync(reservationUploadDir, { recursive: true });
}
if (!fs.existsSync(incidentUploadDir)) {
  fs.mkdirSync(incidentUploadDir, { recursive: true });
}
if (!fs.existsSync(propertyUploadDir)) {
  fs.mkdirSync(propertyUploadDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname_upload, '..', 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ownerDir = path.join(uploadDir, req.params.ownerId);
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true });
    }
    cb(null, ownerDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, timestamp + '-' + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

app.post('/upload/owner/:ownerId', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningun archivo' });
  }
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

app.get('/upload/owner/:ownerId/list', (req, res) => {
  const ownerDir = path.join(uploadDir, req.params.ownerId);
  if (!fs.existsSync(ownerDir)) {
    return res.json([]);
  }

  try {
    const files = fs.readdirSync(ownerDir)
      .filter(name => !name.startsWith('.'))
      .map(name => ({
        filename: name,
        url: `/uploads/owners/${req.params.ownerId}/${name}`
      }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo listar archivos' });
  }
});

app.delete('/upload/owner/:ownerId/:filename', (req, res) => {
  const ownerDir = path.join(uploadDir, req.params.ownerId);
  const filePath = path.join(ownerDir, req.params.filename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

// File upload routes for guest documents
const guestStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const guestDir = path.join(guestUploadDir, req.params.guestId);
    if (!fs.existsSync(guestDir)) {
      fs.mkdirSync(guestDir, { recursive: true });
    }
    cb(null, guestDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, timestamp + '-' + safeName);
  }
});

const guestUpload = multer({
  storage: guestStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

const reservationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const reservationDir = path.join(reservationUploadDir, req.params.reservationId);
    if (!fs.existsSync(reservationDir)) {
      fs.mkdirSync(reservationDir, { recursive: true });
    }
    cb(null, reservationDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, timestamp + '-' + safeName);
  }
});

const reservationUpload = multer({
  storage: reservationStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

const incidentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const incidentDir = path.join(incidentUploadDir, req.params.incidentId);
    if (!fs.existsSync(incidentDir)) {
      fs.mkdirSync(incidentDir, { recursive: true });
    }
    cb(null, incidentDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, timestamp + '-' + safeName);
  }
});

const incidentUpload = multer({
  storage: incidentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

const propertyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const propertyDir = path.join(propertyUploadDir, req.params.propertyId);
    if (!fs.existsSync(propertyDir)) {
      fs.mkdirSync(propertyDir, { recursive: true });
    }
    cb(null, propertyDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const rawType = (req.query && req.query.type ? String(req.query.type) : '')
      || (req.body && req.body.type ? String(req.body.type) : 'document');
    const safeType = rawType.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'document';
    cb(null, `${safeType}-${timestamp}-${safeName}`);
  }
});

const propertyUpload = multer({
  storage: propertyStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

app.post('/upload/guest/:guestId', guestUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningun archivo' });
  }
  res.json({
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: `/uploads/guests/${req.params.guestId}/${req.file.filename}`
    }
  });
});

app.post('/upload/reservation/:reservationId', reservationUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningun archivo' });
  }
  res.json({
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: `/uploads/reservations/${req.params.reservationId}/${req.file.filename}`
    }
  });
});

app.post('/upload/incident/:incidentId', incidentUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningun archivo' });
  }
  res.json({
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: `/uploads/incidents/${req.params.incidentId}/${req.file.filename}`
    }
  });
});

const propertyUploadSingle = propertyUpload.single('file');

app.post('/upload/property/:propertyId', (req, res) => {
  propertyUploadSingle(req, res, (err) => {
    if (err) {
      console.error('Property upload error:', err && err.message ? err.message : err);
      return res.status(400).json({ error: err && err.message ? err.message : 'Error al subir documento' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningun archivo' });
    }
    const rawType = (req.query && req.query.type ? String(req.query.type) : '')
      || (req.body && req.body.type ? String(req.body.type) : 'document');
    const safeType = rawType.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'document';
    res.json({
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        type: safeType,
        path: `/uploads/properties/${req.params.propertyId}/${req.file.filename}`
      }
    });
  });
});

app.get('/files/guest/:guestId', (req, res) => {
  const guestDir = path.join(guestUploadDir, req.params.guestId);
  if (!fs.existsSync(guestDir)) {
    return res.json({ files: [] });
  }

  try {
    const files = fs.readdirSync(guestDir)
      .filter(name => !name.startsWith('.'))
      .map(name => {
        const filePath = path.join(guestDir, name);
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          size: stats.size,
          uploadDate: stats.mtime.toISOString(),
          path: `/uploads/guests/${req.params.guestId}/${name}`
        };
      });
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo listar archivos' });
  }
});

app.delete('/files/guest/:guestId/:filename', (req, res) => {
  const guestDir = path.join(guestUploadDir, req.params.guestId);
  const filePath = path.join(guestDir, req.params.filename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

app.delete('/files/reservation/:reservationId/:filename', (req, res) => {
  const reservationDir = path.join(reservationUploadDir, req.params.reservationId);
  const filePath = path.join(reservationDir, req.params.filename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

app.get('/files/incident/:incidentId', (req, res) => {
  const incidentDir = path.join(incidentUploadDir, req.params.incidentId);
  if (!fs.existsSync(incidentDir)) {
    return res.json({ files: [] });
  }

  try {
    const files = fs.readdirSync(incidentDir)
      .filter(name => !name.startsWith('.'))
      .map(name => {
        const filePath = path.join(incidentDir, name);
        const stats = fs.statSync(filePath);
        return {
          filename: name,
          size: stats.size,
          uploadDate: stats.mtime.toISOString(),
          path: `/uploads/incidents/${req.params.incidentId}/${name}`
        };
      });
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo listar archivos' });
  }
});

app.get('/files/property/:propertyId', (req, res) => {
  const propertyDir = path.join(propertyUploadDir, req.params.propertyId);
  if (!fs.existsSync(propertyDir)) {
    return res.json({ files: [] });
  }

  try {
    const files = fs.readdirSync(propertyDir)
      .filter(name => !name.startsWith('.'))
      .map(name => {
        const filePath = path.join(propertyDir, name);
        const stats = fs.statSync(filePath);
        const parts = name.split('-');
        const type = parts.length > 2 ? parts[0] : 'document';
        const safeDate = stats && stats.mtime instanceof Date && !Number.isNaN(stats.mtime.getTime())
          ? stats.mtime.toISOString()
          : new Date().toISOString();
        return {
          filename: name,
          size: stats.size,
          uploadDate: safeDate,
          type,
          path: `/uploads/properties/${req.params.propertyId}/${name}`
        };
      });
    res.json({ files });
  } catch (err) {
    console.error('Property files list error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'No se pudo listar archivos' });
  }
});

app.delete('/files/incident/:incidentId/:filename', (req, res) => {
  const incidentDir = path.join(incidentUploadDir, req.params.incidentId);
  const filePath = path.join(incidentDir, req.params.filename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

app.delete('/files/property/:propertyId/:filename', (req, res) => {
  const propertyDir = path.join(propertyUploadDir, req.params.propertyId);
  const filePath = path.join(propertyDir, req.params.filename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

// GET endpoint for invoice generation (for client-side calls)
app.get('/invoices/generate', async (req, res) => {
  const reservationId = req.query && (req.query.reservationId || req.query.id);
  if (!reservationId) return res.status(400).json({ error: 'reservationId required' });
  
  try {
    if (!pool) await ensurePool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Lock reservation and get owner
      const [rrows] = await conn.query('SELECT r.id, r.invoiceNumber, p.owner FROM `reservations` r JOIN `properties` p ON r.propertyId = p.id WHERE r.id = ? FOR UPDATE', [reservationId]);
      const r = rrows && rrows[0];
      if (!r) {
        await conn.rollback();
        return res.status(404).json({ error: 'Reservation not found' });
      }
      if (r.invoiceNumber) {
        await conn.rollback();
        return res.status(400).json({ error: 'Reservation already has invoice' });
      }

      const ownerId = r.owner;
      // Lock owner row and compute next invoice number safely
      const [orows] = await conn.query('SELECT lastInvoiceNumber FROM `owners` WHERE id = ? FOR UPDATE', [ownerId]);
      const ownerRow = orows && orows[0];
      const currentLast = ownerRow && ownerRow.lastInvoiceNumber ? Number(ownerRow.lastInvoiceNumber) : 0;
      const series = String(ownerId);
      const [maxInvoiceRows] = await conn.query(
        'SELECT MAX(CAST(SUBSTRING_INDEX(`number`, "/", -1) AS UNSIGNED)) AS maxSeq FROM `invoices` WHERE `number` LIKE ?',
        [`${series}/%`]
      );
      const maxSeq = maxInvoiceRows && maxInvoiceRows[0] && maxInvoiceRows[0].maxSeq ? Number(maxInvoiceRows[0].maxSeq) : 0;
      const nextSeq = Math.max(currentLast + 1, maxSeq + 1);
      await conn.query('UPDATE `owners` SET lastInvoiceNumber = ? WHERE id = ?', [nextSeq, ownerId]);

      const seq = String(nextSeq).padStart(3, '0');
      const invoiceNumber = `${series}/${seq}`;
      const invoiceDate = new Date().toISOString().split('T')[0];

      // Insert invoice record
      try {
        await conn.query('INSERT INTO `invoices` (`number`, reservationId, createdAt) VALUES (?, ?, ?)', [invoiceNumber, reservationId, new Date().toISOString()]);
      } catch (ie) {
        // ignore insert errors but continue
        console.warn('Insert invoice failed:', ie && ie.message ? ie.message : ie);
      }

      // Update reservation: try to set invoiceDate, if column missing fall back to invoiceNumber only
      try {
        await conn.query('UPDATE `reservations` SET invoiceNumber = ?, invoiceDate = ? WHERE id = ?', [invoiceNumber, invoiceDate, reservationId]);
      } catch (ue) {
        console.warn('Could not set invoiceDate, retrying without it:', ue && ue.message ? ue.message : ue);
        await conn.query('UPDATE `reservations` SET invoiceNumber = ? WHERE id = ?', [invoiceNumber, reservationId]);
      }

      await conn.commit();
      res.json({ invoiceNumber, invoiceDate });
    } catch (e) {
      try { await conn.rollback(); } catch (_) {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Invoice generation error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : err });
  }
});

// POST endpoint para generar factura de forma atómica en el servidor
app.post('/invoices/generate', async (req, res) => {
  const reservationId = req.body && (req.body.reservationId || req.body.id || req.body.reservationID);
  if (!reservationId) return res.status(400).json({ error: 'reservationId required' });
  try {
    if (!pool) await ensurePool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Lock reservation and get owner
      const [rrows] = await conn.query('SELECT r.id, r.invoiceNumber, p.owner FROM `reservations` r JOIN `properties` p ON r.propertyId = p.id WHERE r.id = ? FOR UPDATE', [reservationId]);
      const r = rrows && rrows[0];
      if (!r) {
        await conn.rollback();
        return res.status(404).json({ error: 'Reservation not found' });
      }
      if (r.invoiceNumber) {
        await conn.rollback();
        return res.status(400).json({ error: 'Reservation already has invoice' });
      }

      const ownerId = r.owner;
      // Lock owner row and compute next invoice number safely
      const [orows] = await conn.query('SELECT lastInvoiceNumber FROM `owners` WHERE id = ? FOR UPDATE', [ownerId]);
      const ownerRow = orows && orows[0];
      const currentLast = ownerRow && ownerRow.lastInvoiceNumber ? Number(ownerRow.lastInvoiceNumber) : 0;
      const series = String(ownerId);
      const [maxInvoiceRows] = await conn.query(
        'SELECT MAX(CAST(SUBSTRING_INDEX(`number`, "/", -1) AS UNSIGNED)) AS maxSeq FROM `invoices` WHERE `number` LIKE ?',
        [`${series}/%`]
      );
      const maxSeq = maxInvoiceRows && maxInvoiceRows[0] && maxInvoiceRows[0].maxSeq ? Number(maxInvoiceRows[0].maxSeq) : 0;
      const nextSeq = Math.max(currentLast + 1, maxSeq + 1);
      await conn.query('UPDATE `owners` SET lastInvoiceNumber = ? WHERE id = ?', [nextSeq, ownerId]);

      const seq = String(nextSeq).padStart(3, '0');
      const invoiceNumber = `${series}/${seq}`;
      const invoiceDate = new Date().toISOString().split('T')[0];

      // Insert invoice record
      try {
        await conn.query('INSERT INTO `invoices` (`number`, reservationId, createdAt) VALUES (?, ?, ?)', [invoiceNumber, reservationId, new Date().toISOString()]);
      } catch (ie) {
        // ignore insert errors but continue
        console.warn('Insert invoice failed:', ie && ie.message ? ie.message : ie);
      }

      // Update reservation: try to set invoiceDate, if column missing fall back to invoiceNumber only
      try {
        await conn.query('UPDATE `reservations` SET invoiceNumber = ?, invoiceDate = ? WHERE id = ?', [invoiceNumber, invoiceDate, reservationId]);
      } catch (ue) {
        console.warn('Could not set invoiceDate, retrying without it:', ue && ue.message ? ue.message : ue);
        await conn.query('UPDATE `reservations` SET invoiceNumber = ? WHERE id = ?', [invoiceNumber, reservationId]);
      }

      await conn.commit();
      res.json({ invoiceNumber, invoiceDate });
    } catch (e) {
      try { await conn.rollback(); } catch (_) {}
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Invoice generation error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : err });
  }
});

// DELETE endpoint to remove the last invoice in a series (by reservation)
app.delete('/invoices/:reservationId', async (req, res) => {
  const reservationId = String(req.params.reservationId);
  if (!reservationId) return res.status(400).json({ error: 'ReservationId requerido' });

  let conn;
  try {
    if (!pool) await ensurePool();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rrows] = await conn.query(
      'SELECT r.id, r.invoiceNumber, p.owner FROM `reservations` r JOIN `properties` p ON r.propertyId = p.id WHERE r.id = ? FOR UPDATE',
      [reservationId]
    );
    const r = rrows && rrows[0];
    if (!r || !r.invoiceNumber) {
      await conn.rollback();
      return res.status(400).json({ error: 'La reserva no tiene factura' });
    }

    const ownerId = r.owner;
    const series = String(ownerId);
    const invoiceNumber = String(r.invoiceNumber);
    const seqPart = invoiceNumber.split('/').pop() || '';
    const seq = Number(seqPart);
    if (!Number.isFinite(seq) || seq <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Número de factura inválido' });
    }

    const [maxInvoiceRows] = await conn.query(
      'SELECT MAX(CAST(SUBSTRING_INDEX(r.invoiceNumber, "/", -1) AS UNSIGNED)) AS maxSeq FROM `reservations` r JOIN `properties` p ON r.propertyId = p.id WHERE p.owner = ? AND r.invoiceNumber IS NOT NULL AND r.invoiceNumber <> "" AND r.invoiceNumber LIKE ? FOR UPDATE',
      [ownerId, `${series}/%`]
    );
    const maxSeq = maxInvoiceRows && maxInvoiceRows[0] && maxInvoiceRows[0].maxSeq ? Number(maxInvoiceRows[0].maxSeq) : 0;

    if (seq !== maxSeq) {
      await conn.rollback();
      return res.status(400).json({ error: 'Solo se puede eliminar la última factura de la serie' });
    }

    // Delete invoice record and clear reservation invoice fields
    await conn.query('DELETE FROM `invoices` WHERE reservationId = ? OR `number` = ?', [reservationId, invoiceNumber]);
    await conn.query('UPDATE `reservations` SET invoiceNumber = NULL, invoiceDate = NULL WHERE id = ?', [reservationId]);

    const nextLast = Math.max(0, maxSeq - 1);
    await conn.query('UPDATE `owners` SET lastInvoiceNumber = ? WHERE id = ?', [nextLast, ownerId]);

    await conn.commit();
    res.json({ success: true, lastInvoiceNumber: nextLast });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch (_) {}
    console.error('Invoice delete error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Error al eliminar factura' });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/files/owner/:ownerId', (req, res) => {
  const ownerDir = path.join(uploadDir, req.params.ownerId);
  if (!fs.existsSync(ownerDir)) {
    return res.json({ files: [] });
  }
  const files = fs.readdirSync(ownerDir).map(filename => {
    const filePath = path.join(ownerDir, filename);
    const stats = fs.statSync(filePath);
    const parts = filename.split('-');
    const timestamp = parseInt(parts[0]);
    const originalName = parts.slice(1).join('-');
    return {
      filename,
      originalName,
      uploadDate: new Date(timestamp).toISOString(),
      size: stats.size
    };
  });
  res.json({ files });
});

app.delete('/files/owner/:ownerId/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.ownerId, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
});

const PORT = parseInt(process.env.API_PORT || '3003', 10);
const HOST = process.env.API_HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`API server running on ${HOST}:${PORT}`);
});
