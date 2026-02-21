import fs from 'fs';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { NumerosALetras } from 'numero-a-letras';
import { logger } from '../utils/logger.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    'https://n8n-contabo.ddns.net:8444',
    'http://n8n-contabo.ddns.net:8444',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));

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
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10)
  });
  logger.info('DB', 'Created MySQL pool');
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
    logger.error('DB', 'testPool failed', err);
    return false;
  }
};

const ensurePool = async (retries = 3, delayMs = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      if (!pool) pool = createPool();
      const ok = await testPool(pool);
      if (ok) return;
      try {
        await pool.end();
      } catch (_) {
        // ignore
      }
      pool = null;
      pool = createPool();
    } catch (err) {
      logger.error('DB', 'ensurePool attempt failed', err);
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  logger.critical('DB', 'Could not establish MySQL pool after retries');
};

pool = createPool();
ensurePool().then(() => {
  logger.info('DB', 'MySQL pool ready');
}).catch(err => {
  logger.error('DB', 'Pool init error', err);
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down API server, closing MySQL pool...');
  try {
    if (pool) await pool.end();
    console.log('MySQL pool closed.');
  } catch (err) {
    console.error('Error closing pool:', err && err.message ? err.message : err);
  }
  process.exit(0);
}

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

async function filterDataByColumns(table, data) {
  if (!pool) await ensurePool();
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  const validCols = new Set(columns.map(c => c.Field));
  const filtered = {};
  for (const key of Object.keys(data)) {
    if (validCols.has(key)) {
      filtered[key] = data[key];
    }
  }
  return filtered;
}

// ── Invoice format helper ───────────────────────────────────────
// Format: FR0X/00X where 0X is the owner ID padded to 2 digits, 00X is the sequence padded to 3 digits
function formatInvoiceSeries(ownerId) {
  return `FR${String(ownerId).padStart(2, '0')}`;
}
function formatInvoiceNumber(ownerId, seq) {
  return `${formatInvoiceSeries(ownerId)}/${String(seq).padStart(3, '0')}`;
}

// ── Audit log helper ────────────────────────────────────────────
async function logAudit(username, action, tableName, recordId, oldValues, newValues, description) {
  try {
    if (!pool) await ensurePool();
    await pool.query(
      'INSERT INTO `audit_logs` (username, action, tableName, recordId, oldValues, newValues, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        username || 'system',
        action,
        tableName,
        recordId ? String(recordId) : null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        description || null
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err && err.message ? err.message : err);
  }
}

// ── Audit logs endpoint (admin-only) ────────────────────────────
app.get('/audit-logs', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    // Verify requesting user is admin
    const xUser = req.headers['x-user'];
    if (!xUser) return res.status(401).json({ error: 'No autorizado' });
    const [userRows] = await pool.query('SELECT role FROM `users` WHERE LOWER(username) = LOWER(?) LIMIT 1', [xUser]);
    if (!userRows || !userRows[0] || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver los logs' });
    }
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;
    const username = req.query.username || null;
    const tableName = req.query.table || null;
    const dateFrom = req.query.from || null;
    const dateTo = req.query.to || null;

    let sql = 'SELECT * FROM `audit_logs` WHERE 1=1';
    const params = [];
    if (username) { sql += ' AND username = ?'; params.push(username); }
    if (tableName) { sql += ' AND tableName = ?'; params.push(tableName); }
    if (dateFrom) { sql += ' AND timestamp >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND timestamp <= ?'; params.push(dateTo + ' 23:59:59'); }
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET audit-logs error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message });
  }
});

// ── Authentication ──────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    if (!pool) await ensurePool();
    const [rows] = await pool.query(
      'SELECT id, username, role FROM `users` WHERE LOWER(username) = LOWER(?) AND password = ? LIMIT 1',
      [username.trim(), password]
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const user = rows[0];
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    console.error('Login error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ── User management ──────────────────────────────────────────────
app.get('/auth/users', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const [rows] = await pool.query('SELECT id, username, role, createdAt, updatedAt FROM `users`');
    res.json(rows);
  } catch (err) {
    console.error('GET users error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/users', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (!pool) await ensurePool();
    const [existing] = await pool.query('SELECT id FROM `users` WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await pool.query(
      'INSERT INTO `users` (id, username, password, role) VALUES (?, ?, ?, ?)',
      [id, username.trim(), password, role]
    );
    const xUser = req.headers['x-user'] || 'system';
    logAudit(xUser, 'INSERT', 'users', id, null, { username: username.trim(), role }, `Creado usuario ${username.trim()} con rol ${role}`);
    res.json({ id, username: username.trim(), role });
  } catch (err) {
    console.error('POST user error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/auth/users/:id', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!pool) await ensurePool();
    const fields = [];
    const values = [];
    if (username) { fields.push('username = ?'); values.push(username.trim()); }
    if (password) { fields.push('password = ?'); values.push(password); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(req.params.id);
    // Fetch old user for audit
    let oldUser = null;
    try {
      const [oldRows] = await pool.query('SELECT id, username, role FROM `users` WHERE id = ?', [req.params.id]);
      if (oldRows && oldRows[0]) oldUser = oldRows[0];
    } catch (_) {}
    await pool.query(`UPDATE \`users\` SET ${fields.join(', ')} WHERE id = ?`, values);
    const xUser = req.headers['x-user'] || 'system';
    const changes = {};
    if (username) changes.username = username.trim();
    if (role) changes.role = role;
    if (password) changes.password = '***';
    logAudit(xUser, 'UPDATE', 'users', req.params.id, oldUser, changes, `Actualizado usuario ${oldUser ? oldUser.username : req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT user error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/auth/users/:id', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    // Fetch old user for audit
    let oldUser = null;
    try {
      const [oldRows] = await pool.query('SELECT id, username, role FROM `users` WHERE id = ?', [req.params.id]);
      if (oldRows && oldRows[0]) oldUser = oldRows[0];
    } catch (_) {}
    await pool.query('DELETE FROM `users` WHERE id = ?', [req.params.id]);
    const xUser = req.headers['x-user'] || 'system';
    logAudit(xUser, 'DELETE', 'users', req.params.id, oldUser, null, `Eliminado usuario ${oldUser ? oldUser.username : req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE user error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err.message });
  }
});

// ── Contract generation ─────────────────────────────────────────
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function numberToSpanishText(n) {
  // Use NumerosALetras and strip the currency suffix
  const raw = NumerosALetras(n);
  // NumerosALetras returns e.g. "Trescientos Sesenta Pesos 00/100 M.N."
  // We want just "trescientos sesenta"
  return raw.replace(/\s*Pesos?\s*\d+\/\d+\s*M\.N\.?\s*/i, '').trim().toLowerCase();
}

function formatDateSpanish(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function monthsDiff(startStr, endStr) {
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() > s.getDate()) months++;
  return Math.max(1, months);
}

function monthsToSpanish(n) {
  const names = ['uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce'];
  return names[n - 1] || String(n);
}

app.get('/contracts/generate/:reservationId', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const reservationId = req.params.reservationId;

    // Fetch reservation with all related data
    const [rows] = await pool.query(`
      SELECT
        r.id, r.startDate, r.endDate, r.price,
        g.name AS guestName, g.surname AS guestSurname, g.dni AS guestDni, g.phone AS guestPhone, g.email AS guestEmail,
        p.name AS propertyName, p.address AS propertyAddress, p.city AS propertyCity, p.sqm AS propertySqm,
        rm.name AS roomName,
        o.name AS ownerName, o.dni AS ownerDni, o.phone AS ownerPhone, o.email AS ownerEmail, o.iban AS ownerIban, o.taxAddress AS ownerAddress
      FROM reservations r
      JOIN guests g ON r.guestId = g.id
      JOIN properties p ON r.propertyId = p.id
      JOIN rooms rm ON r.roomId = rm.id
      JOIN owners o ON p.owner = o.id
      WHERE r.id = ?
    `, [reservationId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const data = rows[0];

    // Resolve template path lazily (path/fileURLToPath defined later in the file)
    const __file = fileURLToPath(import.meta.url);
    const __dir = path.dirname(__file);
    const contractTemplatePath = path.join(__dir, '..', 'templates', 'contrato-habitacion.docx');

    // Check template exists
    if (!fs.existsSync(contractTemplatePath)) {
      return res.status(500).json({ error: 'Plantilla de contrato no encontrada. Ejecuta: node scripts/generate-contract-template.js' });
    }

    const templateContent = fs.readFileSync(contractTemplatePath, 'binary');
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const rent = Number(data.price) || 0;
    const startDate = typeof data.startDate === 'object' ? data.startDate.toISOString().split('T')[0] : String(data.startDate);
    const endDate = typeof data.endDate === 'object' ? data.endDate.toISOString().split('T')[0] : String(data.endDate);
    const months = monthsDiff(startDate, endDate);

    const templateData = {
      city: data.propertyCity || '',
      contractDate: formatDateSpanish(startDate),
      ownerName: data.ownerName || '',
      ownerDni: data.ownerDni || '',
      ownerAddress: data.ownerAddress || '',
      ownerPhone: data.ownerPhone || '',
      ownerEmail: data.ownerEmail || '',
      ownerIban: data.ownerIban || '',
      guestFullName: `${data.guestName || ''} ${data.guestSurname || ''}`.trim(),
      guestDni: data.guestDni || '',
      guestPhone: data.guestPhone || '',
      guestEmail: data.guestEmail || '',
      propertyAddress: data.propertyAddress || '',
      propertySqm: data.propertySqm ? String(data.propertySqm) : '___',
      roomName: data.roomName || '',
      durationMonths: String(months),
      durationText: monthsToSpanish(months),
      startDateFormatted: formatDateSpanish(startDate),
      endDateFormatted: formatDateSpanish(endDate),
      rentAmount: String(rent),
      rentText: numberToSpanishText(rent) + ' euros',
    };

    doc.render(templateData);

    const buf = doc.getZip().generate({ type: 'nodebuffer' });

    const guestClean = templateData.guestFullName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_');
    const filename = `contrato_${guestClean}_${startDate}.docx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buf.length,
    });
    res.send(buf);
  } catch (err) {
    console.error('Contract generation error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Error al generar contrato' });
  }
});

// ── Empadronamiento authorization ────────────────────────────────
app.get('/empadronamiento/generate/:reservationId', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const reservationId = req.params.reservationId;

    const [rows] = await pool.query(`
      SELECT
        r.id, r.startDate,
        g.name AS guestName, g.surname AS guestSurname, g.dni AS guestDni,
        p.address AS propertyAddress, p.city AS propertyCity,
        o.name AS ownerName, o.dni AS ownerDni
      FROM reservations r
      JOIN guests g ON r.guestId = g.id
      JOIN properties p ON r.propertyId = p.id
      JOIN owners o ON p.owner = o.id
      WHERE r.id = ?
    `, [reservationId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const data = rows[0];
    const __file = fileURLToPath(import.meta.url);
    const __dir = path.dirname(__file);
    const templatePath = path.join(__dir, '..', 'templates', 'autorizacion-empadronamiento.docx');

    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ error: 'Plantilla de empadronamiento no encontrada. Ejecuta: node scripts/generate-empadronamiento-template.js' });
    }

    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const guestFullName = `${data.guestName || ''} ${data.guestSurname || ''}`.trim();
    const today = new Date().toISOString().split('T')[0];

    doc.render({
      fecha: formatDateSpanish(today),
      ownerName: data.ownerName || '',
      ownerDni: data.ownerDni || '',
      guestFullName,
      guestDni: data.guestDni || '',
      propertyAddress: data.propertyAddress || '',
      propertyCity: data.propertyCity || '',
    });

    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    const guestClean = guestFullName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_');
    const filename = `autorizacion_empadronamiento_${guestClean}.docx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buf.length,
    });
    res.send(buf);
  } catch (err) {
    console.error('Empadronamiento generation error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Error al generar autorización de empadronamiento' });
  }
});

// DELETE invoice by reservation (MUST be before generic /:table/:id)
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
    const series = formatInvoiceSeries(ownerId);
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

// ── Export reservations for Excel (Power Query) ─────────────────
app.get('/export/reservations', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const [rows] = await pool.query(`
      SELECT
        r.id                AS reserva_id,
        r.reservationNumber AS numero_reserva,
        r.startDate         AS fecha_inicio,
        r.endDate           AS fecha_fin,
        DATEDIFF(r.endDate, r.startDate) AS noches,
        p.name              AS propiedad,
        p.address           AS direccion_propiedad,
        p.city              AS ciudad,
        rm.name             AS habitacion,
        g.name              AS huesped_nombre,
        g.surname           AS huesped_apellidos,
        g.dni               AS huesped_dni,
        g.phone             AS huesped_telefono,
        g.email             AS huesped_email,
        g.nationality       AS huesped_nacionalidad,
        o.name              AS propietario,
        o.dni               AS propietario_dni,
        o.commission        AS comision_propietario,
        r.price             AS importe,
        ROUND(r.price / 1.10, 2) AS base_imponible,
        ROUND(r.price - (r.price / 1.10), 2) AS iva,
        r.paymentMethod     AS metodo_pago,
        CASE WHEN r.invoiceNumber IS NOT NULL AND r.invoiceNumber != '' THEN 'Sí' ELSE 'No' END AS facturado,
        r.invoiceNumber     AS numero_factura,
        r.invoiceDate       AS fecha_factura,
        r.cashDelivered     AS efectivo_entregado,
        r.status            AS estado,
        r.notes             AS notas,
        r.createdAt         AS creado
      FROM reservations r
      LEFT JOIN properties p  ON r.propertyId = p.id
      LEFT JOIN rooms rm      ON r.roomId = rm.id
      LEFT JOIN guests g      ON r.guestId = g.id
      LEFT JOIN owners o      ON p.owner = o.id
      ORDER BY r.startDate DESC
    `);

    const format = req.query.format;

    if (format === 'csv') {
      if (!rows || rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="reservas.csv"');
        return res.send('');
      }
      const headers = Object.keys(rows[0]);
      const csvRows = [headers.join(';')];
      for (const row of rows) {
        csvRows.push(headers.map(h => {
          let v = row[h];
          if (v === null || v === undefined) return '';
          if (v instanceof Date) v = v.toISOString().slice(0, 10);
          v = String(v).replace(/"/g, '""');
          return `"${v}"`;
        }).join(';'));
      }
      const bom = '\uFEFF';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="reservas.csv"');
      return res.send(bom + csvRows.join('\r\n'));
    }

    // Default: JSON (for Power Query / Excel)
    res.json(rows.map(r => {
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
      }
      return out;
    }));
  } catch (err) {
    logger.error('EXPORT', 'Error exporting reservations', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Generic CRUD ────────────────────────────────────────────────
const ALLOWED_TABLES = ['reservations', 'properties', 'rooms', 'guests', 'owners', 'managers', 'incidents', 'invoices', 'notes', 'users'];

app.get('/:table', async (req, res) => {
  try {
    if (!ALLOWED_TABLES.includes(req.params.table)) return res.status(400).json({ error: 'Tabla no permitida' });
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
    if (!ALLOWED_TABLES.includes(req.params.table)) return res.status(400).json({ error: 'Tabla no permitida' });
    if (!pool) await ensurePool();
    console.log('POST body:', JSON.stringify(req.body));
    let data = formatDateFields({ ...req.body });
    // Map booking fields for reservations
    if (req.params.table === 'reservations' || req.params.table === 'bookings') {
      data = mapBookingFields(data);
    }
    // Remove id if it's a temp id
    if (typeof data.id === 'string' && data.id.startsWith('temp-')) {
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
    const [result] = await pool.query(sql, values);
    const inserted = { ...data, id: result.insertId };
    if (req.params.table === 'properties') {
      try {
        await syncRoomsForProperty(String(result.insertId), data.numRooms);
      } catch (e) {
        console.warn('Room sync failed on property create:', e && e.message ? e.message : e);
      }
    }
    const xUser = req.headers['x-user'] || 'system';
    logAudit(xUser, 'INSERT', req.params.table, result.insertId, null, data, `Creado registro en ${req.params.table}`);
    res.json(inserted);
  } catch (err) {
    console.error('POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/:table/:id', async (req, res) => {
  try {
    if (!ALLOWED_TABLES.includes(req.params.table)) return res.status(400).json({ error: 'Tabla no permitida' });
    if (!pool) await ensurePool();
    // Fetch old values for audit
    let oldValues = null;
    try {
      const [oldRows] = await pool.query(`SELECT * FROM \`${req.params.table}\` WHERE id = ?`, [req.params.id]);
      if (oldRows && oldRows[0]) oldValues = oldRows[0];
    } catch (_) {}

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

    // Protect invoiced reservations from changes to core fields
    if (req.params.table === 'reservations' && oldValues && oldValues.invoiceNumber) {
      const protectedFields = ['price', 'startDate', 'endDate', 'propertyId', 'roomId', 'guestId', 'paymentMethod'];
      const violations = protectedFields.filter(f => {
        if (data[f] === undefined) return false;
        return String(data[f]) !== String(oldValues[f]);
      });
      if (violations.length > 0) {
        return res.status(400).json({
          error: `No se pueden modificar campos protegidos de una reserva facturada: ${violations.join(', ')}`
        });
      }
    }

    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => '\`'+k+'\` = ?').join(', ');
    await pool.query(`UPDATE \`${req.params.table}\` SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
    if (req.params.table === 'properties' && data.numRooms !== undefined) {
      try {
        await syncRoomsForProperty(String(req.params.id), data.numRooms);
      } catch (e) {
        console.warn('Room sync failed on property update:', e && e.message ? e.message : e);
      }
    }
    const xUser = req.headers['x-user'] || 'system';
    logAudit(xUser, 'UPDATE', req.params.table, req.params.id, oldValues, data, `Actualizado registro ${req.params.id} en ${req.params.table}`);
    res.json({ ...data, id: parseInt(req.params.id) });
  } catch (err) {
    console.error('PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/:table/:id', async (req, res) => {
  try {
    if (!ALLOWED_TABLES.includes(req.params.table)) return res.status(400).json({ error: 'Tabla no permitida' });
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
    // Fetch old values for audit before deleting
    let oldValues = null;
    try {
      const [oldRows] = await pool.query(`SELECT * FROM \`${req.params.table}\` WHERE id = ?`, [req.params.id]);
      if (oldRows && oldRows[0]) oldValues = oldRows[0];
    } catch (_) {}

    await pool.query(`DELETE FROM \`${req.params.table}\` WHERE id = ?`, [req.params.id]);
    const xUser = req.headers['x-user'] || 'system';
    logAudit(xUser, 'DELETE', req.params.table, req.params.id, oldValues, null, `Eliminado registro ${req.params.id} de ${req.params.table}`);
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
      const series = formatInvoiceSeries(ownerId);
      // Lock owner row and compute next invoice number safely
      const [orows] = await conn.query('SELECT lastInvoiceNumber FROM `owners` WHERE id = ? FOR UPDATE', [ownerId]);
      const ownerRow = orows && orows[0];
      const currentLast = ownerRow && ownerRow.lastInvoiceNumber ? Number(ownerRow.lastInvoiceNumber) : 0;
      const [maxInvoiceRows] = await conn.query(
        'SELECT MAX(CAST(SUBSTRING_INDEX(`number`, "/", -1) AS UNSIGNED)) AS maxSeq FROM `invoices` WHERE `number` LIKE ?',
        [`${series}/%`]
      );
      const maxSeq = maxInvoiceRows && maxInvoiceRows[0] && maxInvoiceRows[0].maxSeq ? Number(maxInvoiceRows[0].maxSeq) : 0;
      const nextSeq = Math.max(currentLast + 1, maxSeq + 1);
      await conn.query('UPDATE `owners` SET lastInvoiceNumber = ? WHERE id = ?', [nextSeq, ownerId]);

      const invoiceNumber = formatInvoiceNumber(ownerId, nextSeq);
      const invoiceDate = new Date().toISOString().split('T')[0];

      // Insert invoice record
      try {
        await conn.query('INSERT INTO `invoices` (`number`, reservationId, createdAt) VALUES (?, ?, ?)', [invoiceNumber, reservationId, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
      } catch (ie) {
        console.warn('Insert invoice failed:', ie && ie.message ? ie.message : ie);
      }

      // Update reservation
      try {
        await conn.query('UPDATE `reservations` SET invoiceNumber = ?, invoiceDate = ? WHERE id = ?', [invoiceNumber, invoiceDate, reservationId]);
      } catch (ue) {
        console.warn('Could not set invoiceDate, retrying without it:', ue && ue.message ? ue.message : ue);
        await conn.query('UPDATE `reservations` SET invoiceNumber = ? WHERE id = ?', [invoiceNumber, reservationId]);
      }

      await conn.commit();
      const xUser = req.headers['x-user'] || 'system';
      logAudit(xUser, 'INSERT', 'invoices', invoiceNumber, null, { invoiceNumber, reservationId, invoiceDate }, `Generada factura ${invoiceNumber} para reserva ${reservationId}`);
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
      const series = formatInvoiceSeries(ownerId);
      const [orows] = await conn.query('SELECT lastInvoiceNumber FROM `owners` WHERE id = ? FOR UPDATE', [ownerId]);
      const ownerRow = orows && orows[0];
      const currentLast = ownerRow && ownerRow.lastInvoiceNumber ? Number(ownerRow.lastInvoiceNumber) : 0;
      const [maxInvoiceRows] = await conn.query(
        'SELECT MAX(CAST(SUBSTRING_INDEX(`number`, "/", -1) AS UNSIGNED)) AS maxSeq FROM `invoices` WHERE `number` LIKE ?',
        [`${series}/%`]
      );
      const maxSeq = maxInvoiceRows && maxInvoiceRows[0] && maxInvoiceRows[0].maxSeq ? Number(maxInvoiceRows[0].maxSeq) : 0;
      const nextSeq = Math.max(currentLast + 1, maxSeq + 1);
      await conn.query('UPDATE `owners` SET lastInvoiceNumber = ? WHERE id = ?', [nextSeq, ownerId]);

      const invoiceNumber = formatInvoiceNumber(ownerId, nextSeq);
      const invoiceDate = new Date().toISOString().split('T')[0];

      try {
        await conn.query('INSERT INTO `invoices` (`number`, reservationId, createdAt) VALUES (?, ?, ?)', [invoiceNumber, reservationId, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
      } catch (ie) {
        console.warn('Insert invoice failed:', ie && ie.message ? ie.message : ie);
      }

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

// (DELETE /invoices/:reservationId moved before generic CRUD to avoid route shadowing)

// ── Invoice list with rich JOINs ──
app.get('/invoices/list', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const [rows] = await pool.query(`
      SELECT
        i.id,
        i.number AS invoiceNumber,
        i.reservationId,
        i.createdAt,
        r.invoiceDate,
        r.startDate,
        r.endDate,
        r.price,
        r.paymentMethod,
        g.name AS guestName,
        g.surname AS guestSurname,
        g.dni AS guestDni,
        p.id AS propertyId,
        p.name AS propertyName,
        o.id AS ownerId,
        o.name AS ownerName,
        o.taxId AS ownerTaxId,
        o.taxAddress AS ownerTaxAddress
      FROM invoices i
      JOIN reservations r ON i.reservationId = r.id
      JOIN guests g ON r.guestId = g.id
      JOIN properties p ON r.propertyId = p.id
      JOIN owners o ON p.owner = o.id
      ORDER BY i.createdAt DESC
    `);
    const normalized = Array.isArray(rows) ? rows.map(normalizeRowDates) : [];
    res.json(normalized);
  } catch (err) {
    console.error('GET invoices/list error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : err });
  }
});

// ── Count paid reservations without invoice (supports date/owner filters) ──
app.get('/invoices/pending-count', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const { fromDate, toDate, ownerId } = req.query;
    let sql = `
      SELECT COUNT(*) AS count FROM reservations r
      JOIN properties p ON r.propertyId = p.id
      WHERE r.paymentMethod IN ('transfer', 'cash')
        AND (r.invoiceNumber IS NULL OR r.invoiceNumber = '')
    `;
    const params = [];
    if (fromDate) { sql += ' AND r.startDate >= ?'; params.push(fromDate); }
    if (toDate) { sql += ' AND r.startDate <= ?'; params.push(toDate); }
    if (ownerId) { sql += ' AND p.owner = ?'; params.push(ownerId); }
    const [rows] = await pool.query(sql, params);
    res.json({ count: rows && rows[0] ? Number(rows[0].count) : 0 });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : err });
  }
});

// ── Batch invoice generation for paid reservations without invoice ──
// Invoices are consecutive per owner, ordered by reservation startDate (no gaps)
// Accepts optional body params: fromDate, toDate, ownerId
app.post('/invoices/generate-batch', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const { fromDate, toDate, ownerId } = req.body || {};
    // Order by owner, then by startDate to ensure consecutive numbering by date
    let sql = `
      SELECT r.id AS reservationId, p.owner AS ownerId, r.startDate
      FROM reservations r
      JOIN properties p ON r.propertyId = p.id
      WHERE r.paymentMethod IN ('transfer', 'cash')
        AND (r.invoiceNumber IS NULL OR r.invoiceNumber = '')
    `;
    const params = [];
    if (fromDate) { sql += ' AND r.startDate >= ?'; params.push(fromDate); }
    if (toDate) { sql += ' AND r.startDate <= ?'; params.push(toDate); }
    if (ownerId) { sql += ' AND p.owner = ?'; params.push(ownerId); }
    sql += ' ORDER BY p.owner, r.startDate ASC';
    const [pending] = await pool.query(sql, params);
    if (!pending || pending.length === 0) {
      return res.json({ generated: 0, errors: [] });
    }

    // Group by owner preserving startDate order
    const byOwner = {};
    for (const row of pending) {
      const oid = String(row.ownerId);
      if (!byOwner[oid]) byOwner[oid] = [];
      byOwner[oid].push(row.reservationId);
    }

    let generated = 0;
    const errors = [];
    const invoiceDate = new Date().toISOString().split('T')[0];

    for (const [ownerId, reservationIds] of Object.entries(byOwner)) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [orows] = await conn.query('SELECT lastInvoiceNumber FROM owners WHERE id = ? FOR UPDATE', [ownerId]);
        const currentLast = orows && orows[0] ? Number(orows[0].lastInvoiceNumber) : 0;
        const series = formatInvoiceSeries(ownerId);
        const [maxRows] = await conn.query(
          'SELECT MAX(CAST(SUBSTRING_INDEX(`number`, "/", -1) AS UNSIGNED)) AS maxSeq FROM invoices WHERE `number` LIKE ?',
          [`${series}/%`]
        );
        const maxSeq = maxRows && maxRows[0] && maxRows[0].maxSeq ? Number(maxRows[0].maxSeq) : 0;
        let nextSeq = Math.max(currentLast + 1, maxSeq + 1);

        for (const resId of reservationIds) {
          try {
            const invoiceNumber = formatInvoiceNumber(ownerId, nextSeq);
            await conn.query('INSERT INTO invoices (`number`, reservationId, createdAt) VALUES (?, ?, ?)', [invoiceNumber, resId, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
            try {
              await conn.query('UPDATE reservations SET invoiceNumber = ?, invoiceDate = ? WHERE id = ?', [invoiceNumber, invoiceDate, resId]);
            } catch (ue) {
              await conn.query('UPDATE reservations SET invoiceNumber = ? WHERE id = ?', [invoiceNumber, resId]);
            }
            nextSeq++;
            generated++;
          } catch (innerErr) {
            errors.push({ reservationId: resId, error: innerErr && innerErr.message ? innerErr.message : String(innerErr) });
          }
        }

        await conn.query('UPDATE owners SET lastInvoiceNumber = ? WHERE id = ?', [nextSeq - 1, ownerId]);
        await conn.commit();
      } catch (ownerErr) {
        try { await conn.rollback(); } catch (_) {}
        errors.push({ ownerId, error: ownerErr && ownerErr.message ? ownerErr.message : String(ownerErr) });
      } finally {
        conn.release();
      }
    }

    const xUser = req.headers['x-user'] || 'system';
    logAudit(xUser, 'BATCH', 'invoices', null, null, { generated, errorCount: errors.length }, `Batch invoice generation: ${generated} created`);
    res.json({ generated, errors });
  } catch (err) {
    console.error('Batch invoice error:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'Error en generacion masiva' });
  }
});

// ── PDF invoice generation (matches Brickstarter template) ──
app.get('/invoices/:invoiceNumber/pdf', async (req, res) => {
  try {
    if (!pool) await ensurePool();
    const invoiceNumber = req.params.invoiceNumber.replace('-', '/');

    const [rows] = await pool.query(`
      SELECT
        r.id AS reservationId,
        r.invoiceNumber,
        r.invoiceDate,
        r.startDate,
        r.endDate,
        r.price,
        r.paymentMethod,
        g.name AS guestName,
        g.surname AS guestSurname,
        g.dni AS guestDni,
        p.name AS propertyName,
        p.address AS propertyAddress,
        p.city AS propertyCity,
        o.name AS ownerName,
        o.taxId AS ownerTaxId,
        o.taxAddress AS ownerTaxAddress,
        o.iban AS ownerIban
      FROM reservations r
      JOIN guests g ON r.guestId = g.id
      JOIN properties p ON r.propertyId = p.id
      JOIN owners o ON p.owner = o.id
      WHERE r.invoiceNumber = ?
      LIMIT 1
    `, [invoiceNumber]);

    if (!rows || !rows[0]) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    const d = rows[0];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${req.params.invoiceNumber}.pdf"`);
    doc.pipe(res);

    const TEAL = '#00BFA5';
    const BLACK = '#000000';
    const GRAY = '#666666';
    const LIGHT_GRAY = '#e0e0e0';

    // IVA calculation: price includes 10% IVA
    const totalAmount = Number(d.price || 0);
    const baseImponible = +(totalAmount / 1.10).toFixed(2);
    const ivaAmount = +(totalAmount - baseImponible).toFixed(2);

    // ── Header: FACTURA title (right-aligned) ──
    doc.fontSize(36).font('Helvetica-Bold').fillColor(TEAL)
       .text('FACTURA', 50, 40, { width: 500, align: 'right' });

    // ── Issuer data (left) + Date/Number (right) ──
    const issuerY = 95;
    doc.fontSize(10).font('Helvetica').fillColor(BLACK)
       .text(d.ownerName || '', 50, issuerY)
       .text(d.ownerTaxId || '', 50);
    const taxAddr = d.ownerTaxAddress || '';
    if (taxAddr) {
      const addrParts = taxAddr.split(',').map(s => s.trim());
      addrParts.forEach(part => doc.text(part, 50));
    }

    // Date and invoice number (right-aligned labels + values)
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text('FECHA:', 350, issuerY, { width: 100 });
    doc.fontSize(10).font('Helvetica').fillColor(BLACK)
       .text(d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES'), 450, issuerY, { width: 100, align: 'right' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text('FACTURA N\u00ba', 350, issuerY + 16, { width: 100 });
    doc.fontSize(10).font('Helvetica').fillColor(BLACK)
       .text(d.invoiceNumber || '', 450, issuerY + 16, { width: 100, align: 'right' });

    // ── FACTURAR A section ──
    const billToY = Math.max(doc.y, issuerY + 55) + 15;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text('FACTURAR A:', 50, billToY);
    doc.fontSize(10).font('Helvetica').fillColor(BLACK)
       .text(`${d.guestName || ''} ${d.guestSurname || ''}`.trim(), 50)
       .text(d.guestDni || '', 50);

    // ── DESCRIPCION section ──
    const descY = doc.y + 30;
    // Teal left border bar
    doc.rect(50, descY, 4, 18).fill(TEAL);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(TEAL)
       .text('DESCRIPCI\u00d3N', 62, descY + 3);

    // Description content
    const contentY = descY + 40;
    const startDay = d.startDate ? new Date(d.startDate).getDate() : '';
    const endDay = d.endDate ? new Date(d.endDate).getDate() : '';
    const startMonth = d.startDate ? new Date(d.startDate).toLocaleDateString('es-ES', { month: 'long' }) : '';
    const periodText = `${startMonth} ${startDay}-${endDay}`;

    doc.fontSize(11).font('Helvetica').fillColor(BLACK)
       .text('Estancia', 50, contentY);
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text(`  ${d.propertyName || ''}`, 50)
       .text(`  ${periodText}`, 50);

    // Amount right-aligned at same height
    const fmtNum = (n) => n.toFixed(2).replace('.', ',');
    doc.fontSize(11).font('Helvetica').fillColor(BLACK)
       .text(fmtNum(baseImponible), 430, contentY, { width: 115, align: 'right' });

    // ── Totals section ──
    const totalsY = Math.max(doc.y, contentY + 60) + 40;
    // Separator line
    doc.moveTo(300, totalsY).lineTo(545, totalsY).strokeColor(LIGHT_GRAY).lineWidth(1).stroke();

    const labelX = 300;
    const valueX = 430;
    const valueW = 115;

    // SUBTOTAL
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text('SUBTOTAL', labelX, totalsY + 10, { width: 120, align: 'right' });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text(`${fmtNum(baseImponible)} \u20AC`, valueX, totalsY + 10, { width: valueW, align: 'right' });

    // IVA 10%
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text('IVA 10%', labelX, totalsY + 28, { width: 120, align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text(`${fmtNum(ivaAmount)} \u20AC`, valueX, totalsY + 28, { width: valueW, align: 'right' });

    // IRPF 7% (placeholder line, empty amount)
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text('IRPF 7%', labelX, totalsY + 44, { width: 120, align: 'right' });

    // TOTAL
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BLACK)
       .text('TOTAL', labelX, totalsY + 66, { width: 120, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BLACK)
       .text(`${fmtNum(totalAmount)} \u20AC`, valueX, totalsY + 66, { width: valueW, align: 'right' });

    // ── Payment info ──
    const payY = totalsY + 100;
    const payMethodText = d.paymentMethod === 'transfer' ? 'Transferencia bancaria' : d.paymentMethod === 'cash' ? 'Efectivo' : d.paymentMethod;
    const ibanText = d.ownerIban ? ` en la cuenta ${d.ownerIban}` : '';

    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text('Vencimiento', 50, payY, { width: 120 });
    doc.fontSize(10).font('Helvetica').fillColor(BLACK)
       .text('A la vista', 170, payY);

    doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
       .text('Forma de Pago', 50, payY + 18, { width: 120 });
    doc.fontSize(10).font('Helvetica').fillColor(BLACK)
       .text(`${payMethodText}${ibanText}`, 170, payY + 18, { width: 375 });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err && err.message ? err.message : err);
    if (!res.headersSent) {
      res.status(500).json({ error: err && err.message ? err.message : 'Error generando PDF' });
    }
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
