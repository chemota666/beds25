import fs from 'fs';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

import proxyPool from './mysqlProxyPool.js';
const app = express();
app.use(cors());
app.use(express.json());

const pool = process.env.CODESPACES ? proxyPool : mysql.createPool({
  host: '127.0.0.1',
  user: 'roomflow',
  password: 'roomflow123',
  database: 'roomflow_pms',
  waitForConnections: true,
  connectionLimit: 10
});

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
function formatDateFields(data) {
  const dateFields = ['startDate', 'endDate', 'checkIn', 'checkOut', 'issueDate', 'dueDate', 'paidDate', 'soldDate'];
  const result = { ...data };
  dateFields.forEach(field => {
    if (result[field]) {
      const date = new Date(result[field]);
      if (!isNaN(date.getTime())) {
        result[field] = date.toISOString().split('T')[0];
      }
    }
  });
  return result;
}

app.get('/:table', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${req.params.table}\``);
    res.json(rows);
  } catch (err) {
    console.error('GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/:table', async (req, res) => {
  try {
    console.log('POST body:', JSON.stringify(req.body));
    const data = { ...req.body };
    // Remove id if it's a temp id
    if (data.id && String(data.id).startsWith('temp_')) {
      delete data.id;
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${req.params.table}\` (${keys.map(k => '\`'+k+'\`').join(', ')}) VALUES (${placeholders})`;
    console.log('SQL:', sql);
    const [result] = await pool.query(sql, values);
    res.json({ ...data, id: result.insertId });
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
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => '\`'+k+'\` = ?').join(', ');
    await pool.query(`UPDATE \`${req.params.table}\` SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
    res.json({ ...req.body, id: parseInt(req.params.id) });
  } catch (err) {
    console.error('PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/:table/:id', async (req, res) => {
  try {
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

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

app.listen(3003, '127.0.0.1', () => {
  console.log('API server running on port 3003');
});

// ============================================
// ENDPOINTS CRUD - CONECTAR SERVICIOS
// ============================================
const { OwnersService } = require('./services/ownersService.js');
const { PropertiesService } = require('./services/propertiesService.js');
const { InvoicesService } = require('./services/invoicesService.js');

// Inicializar servicios
const ownersService = new OwnersService(proxyPool);
const propertiesService = new PropertiesService(proxyPool);
const invoicesService = new InvoicesService(proxyPool, ownersService);

// ============= OWNERS ENDPOINTS =============
// GET /api/owners - Obtener todos los propietarios
app.get('/api/owners', async (req, res) => {
  try {
    const owners = await ownersService.getAllOwners();
    res.json(owners);
  } catch (error) {
    console.error('Error getting owners:', error);
    res.status(500).json({ error: 'Error al obtener propietarios' });
  }
});

// GET /api/owners/:id - Obtener un propietario por ID
app.get('/api/owners/:id', async (req, res) => {
  try {
    const owner = await ownersService.getOwnerById(parseInt(req.params.id));
    if (!owner) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }
    res.json(owner);
  } catch (error) {
    console.error('Error getting owner:', error);
    res.status(500).json({ error: 'Error al obtener propietario' });
  }
});

// POST /api/owners - Crear nuevo propietario
app.post('/api/owners', async (req, res) => {
  try {
    const newOwner = await ownersService.createOwner(req.body);
    res.status(201).json(newOwner);
  } catch (error) {
    console.error('Error creating owner:', error);
    res.status(500).json({ error: 'Error al crear propietario' });
  }
});

// PUT /api/owners/:id - Actualizar propietario
app.put('/api/owners/:id', async (req, res) => {
  try {
    const updated = await ownersService.updateOwner(parseInt(req.params.id), req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating owner:', error);
    res.status(500).json({ error: 'Error al actualizar propietario' });
  }
});

// DELETE /api/owners/:id - Eliminar propietario
app.delete('/api/owners/:id', async (req, res) => {
  try {
    await ownersService.deleteOwner(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting owner:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= PROPERTIES ENDPOINTS =============
// GET /api/properties - Obtener todas las propiedades
app.get('/api/properties', async (req, res) => {
  try {
    const ownerId = req.query.ownerId ? parseInt(req.query.ownerId) : undefined;
    const properties = await propertiesService.getAllProperties(ownerId);
    res.json(properties);
  } catch (error) {
    console.error('Error getting properties:', error);
    res.status(500).json({ error: 'Error al obtener propiedades' });
  }
});

// GET /api/properties/:id - Obtener una propiedad por ID
app.get('/api/properties/:id', async (req, res) => {
  try {
    const property = await propertiesService.getPropertyById(parseInt(req.params.id));
    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    res.json(property);
  } catch (error) {
    console.error('Error getting property:', error);
    res.status(500).json({ error: 'Error al obtener propiedad' });
  }
});

// POST /api/properties - Crear nueva propiedad con rooms
app.post('/api/properties', async (req, res) => {
  try {
    const newProperty = await propertiesService.createProperty(req.body);
    res.status(201).json(newProperty);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Error al crear propiedad' });
  }
});

// PUT /api/properties/:id - Actualizar propiedad
app.put('/api/properties/:id', async (req, res) => {
  try {
    const updated = await propertiesService.updateProperty(parseInt(req.params.id), req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Error al actualizar propiedad' });
  }
});

// DELETE /api/properties/:id - Eliminar propiedad
app.delete('/api/properties/:id', async (req, res) => {
  try {
    await propertiesService.deleteProperty(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/properties/:id/rooms - Obtener habitaciones de una propiedad
app.get('/api/properties/:id/rooms', async (req, res) => {
  try {
    const rooms = await propertiesService.getRoomsByProperty(parseInt(req.params.id));
    res.json(rooms);
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Error al obtener habitaciones' });
  }
});

// ============= INVOICES ENDPOINTS =============
// POST /api/reservations/:id/mark-paid - Marcar reserva como pagada y generar factura
app.post('/api/reservations/:id/mark-paid', async (req, res) => {
  try {
    const { paymentMethod, amount } = req.body;
    const invoice = await invoicesService.markPaidAndCreateInvoice({
      reservationId: parseInt(req.params.id),
      paymentMethod,
      amount
    });
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error marking paid and creating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invoices - Obtener todas las facturas
app.get('/api/invoices', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const invoices = await invoicesService.getAllInvoices(limit, offset);
    res.json(invoices);
  } catch (error) {
    console.error('Error getting invoices:', error);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

// GET /api/invoices/:id - Obtener una factura por ID
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await invoicesService.getInvoiceById(parseInt(req.params.id));
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
});

console.log('\u2705 Endpoints CRUD conectados exitosamente');
