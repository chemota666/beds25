const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'n8n-contabo.ddns.net',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'roomflow',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'roomflow_pms',
  waitForConnections: true,
  connectionLimit: 10
});

const VALID_TABLES = ['properties', 'rooms', 'reservations', 'guests', 'owners'];

const UPLOAD_BASE = '/tmp/roomflow-uploads';
if (!fs.existsSync(UPLOAD_BASE)) { fs.mkdirSync(UPLOAD_BASE, { recursive: true }); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ownerDir = path.join(UPLOAD_BASE, 'owners', req.params.ownerId);
    if (!fs.existsSync(ownerDir)) { fs.mkdirSync(ownerDir, { recursive: true }); }
    cb(null, ownerDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, Date.now() + '_' + baseName + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

app.post('/upload/owner/:ownerId', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ success: true, file: { filename: req.file.filename, originalName: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype, uploadDate: new Date().toISOString(), path: '/uploads/owners/' + req.params.ownerId + '/' + req.file.filename } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/files/owner/:ownerId', (req, res) => {
  try {
    const d = path.join(UPLOAD_BASE, 'owners', req.params.ownerId);
    if (!fs.existsSync(d)) return res.json({ files: [] });
    res.json({ files: fs.readdirSync(d).map(f => ({ filename: f, size: fs.statSync(path.join(d,f)).size, uploadDate: fs.statSync(path.join(d,f)).mtime.toISOString(), path: '/uploads/owners/' + req.params.ownerId + '/' + f })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/files/owner/:ownerId/:filename', (req, res) => {
  try {
    const fp = path.join(UPLOAD_BASE, 'owners', req.params.ownerId, req.params.filename);
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); res.json({ success: true }); }
    else { res.status(404).json({ error: 'Not found' }); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all
app.get('/:table', async (req, res) => {
  const t = req.params.table;
  if (!VALID_TABLES.includes(t)) return res.status(404).json({ error: 'Not found' });
  try {
    const [rows] = await pool.query('SELECT * FROM ' + t + ' ORDER BY id DESC');
    res.json(rows);
  } catch (e) { console.error('[GET]', t, e.message); res.status(500).json({ error: e.message }); }
});

// GET one
app.get('/:table/:id', async (req, res) => {
  const { table: t, id } = req.params;
  if (!VALID_TABLES.includes(t)) return res.status(404).json({ error: 'Not found' });
  try {
    const [rows] = await pool.query('SELECT * FROM ' + t + ' WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { console.error('[GET]', t, id, e.message); res.status(500).json({ error: e.message }); }
});

// POST - upsert: if id is numeric and exists, UPDATE; otherwise INSERT
app.post('/:table', async (req, res) => {
  const t = req.params.table;
  if (!VALID_TABLES.includes(t)) return res.status(404).json({ error: 'Not found' });
  try {
    const data = { ...req.body };
    delete data.createdAt;
    delete data.updatedAt;
    console.log("[POST DEBUG]", t, "body:", JSON.stringify(req.body)); const existingId = data.id;
    
    // Check if this is an update (id is numeric and exists in DB)
    if (existingId && !isNaN(Number(existingId))) {
      const [existing] = await pool.query('SELECT id FROM ' + t + ' WHERE id = ?', [existingId]);
      if (existing.length > 0) {
        // UPDATE
        delete data.id;
        const cols = Object.keys(data);
        const vals = Object.values(data);
        const setClause = cols.map(c => c + ' = ?').join(', ');
        const sql = 'UPDATE ' + t + ' SET ' + setClause + ' WHERE id = ?';
        console.log('[UPDATE via POST]', t, sql, [...vals, existingId]);
        await pool.query(sql, [...vals, existingId]);
        return res.json({ id: existingId, ...data });
      }
    }
    
    // INSERT - remove non-numeric or temp ids
    if (!existingId || String(existingId).startsWith('temp_') || isNaN(Number(existingId))) {
      delete data.id;
    }
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const ph = cols.map(() => '?').join(', ');
    const sql = 'INSERT INTO ' + t + ' (' + cols.join(', ') + ') VALUES (' + ph + ')';
    console.log('[INSERT]', t, sql, vals);
    const [result] = await pool.query(sql, vals);
    // Auto-create rooms if inserting a property
    if (t === "properties" && data.numRooms) {
      const propertyId = result.insertId;
      const numRooms = parseInt(data.numRooms) || 0;
      for (let i = 1; i <= numRooms; i++) {
        await pool.query("INSERT INTO rooms (propertyId, name) VALUES (?, ?)", [propertyId, "Habitaci00f3n " + i]);
      }
      console.log("[AUTO-CREATE ROOMS]", numRooms, "rooms created for property", propertyId);
    }
    res.json({ id: result.insertId, ...data });
  } catch (e) { console.error('[POST]', t, e.message); res.status(500).json({ error: e.message }); }
});

// PUT update
app.put('/:table/:id', async (req, res) => {
  const { table: t, id } = req.params;
  if (!VALID_TABLES.includes(t)) return res.status(404).json({ error: 'Not found' });
  try {
    const data = { ...req.body };
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    // If id is non-numeric, do INSERT instead of UPDATE
    if (isNaN(Number(id))) {
      console.log("[PUT->INSERT]", t, "non-numeric id:", id);
      const cols = Object.keys(data);
      const vals = Object.values(data);
      const ph = cols.map(() => "?").join(", ");
      const sql = "INSERT INTO " + t + " (" + cols.join(", ") + ") VALUES (" + ph + ")";
      console.log("[INSERT via PUT]", t, sql, vals);
      const [result] = await pool.query(sql, vals);
      return res.json({ id: result.insertId, ...data });
    }
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const sql = 'UPDATE ' + t + ' SET ' + cols.map(c => c + ' = ?').join(', ') + ' WHERE id = ?';
    console.log('[PUT]', t, sql, [...vals, id]);
    await pool.query(sql, [...vals, id]);
    res.json({ id, ...data });
  } catch (e) { console.error('[PUT]', t, id, e.message); res.status(500).json({ error: e.message }); }
});

// DELETE
app.delete('/:table/:id', async (req, res) => {
  const { table: t, id } = req.params;
  if (!VALID_TABLES.includes(t)) return res.status(404).json({ error: 'Not found' });
  try {
    await pool.query('DELETE FROM ' + t + ' WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) { console.error('[DELETE]', t, id, e.message); res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  pool.query('SELECT 1').then(() => console.log('MySQL connected')).catch(e => console.error('MySQL error:', e.message));
});
