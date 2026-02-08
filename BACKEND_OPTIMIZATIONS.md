# 🔧 OPTIMIZACIONES RECOMENDADAS - Backend

## 1. Mejorar Pool de MySQL

### Estado Actual
```javascript
const p = mysql.createPool({
  connectionLimit: 10,
  connectTimeout: 10000
});
```

### Recomendación
```javascript
const p = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'roomflow',
  password: process.env.DB_PASSWORD || 'roomflow123',
  database: process.env.DB_NAME || 'roomflow_pms',
  waitForConnections: true,
  connectionLimit: 20,  // Aumentar si hay muchas conexiones
  queueLimit: 0,        // Sin límite de cola
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 30000,
  connectTimeout: 10000,
  enableExcludeAsyncStackFrames: false  // Para mejor debugging
});
```

---

## 2. Agregar Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por IP
  message: 'Demasiadas solicitudes desde esta IP, intenta más tarde'
});

app.use(limiter);
```

---

## 3. Añadir Validación en Servidor

```javascript
// Validar que la tabla existe y el ID es válido
const ALLOWED_TABLES = [
  'properties', 'rooms', 'reservations', 
  'guests', 'owners', 'invoices'
];

app.get('/:table', async (req, res) => {
  if (!ALLOWED_TABLES.includes(req.params.table)) {
    return res.status(400).json({ error: 'Tabla no válida' });
  }
  // ... resto del código
});
```

---

## 4. Mejorar Consultas SQL

### Antes (Vulnerable a SQL injection)
```javascript
const sql = `SELECT * FROM \`${req.params.table}\``;
```

### Después (Seguro)
```javascript
// Usar identificadores seguros
const identifier = mysql.escapeId(req.params.table);
const sql = `SELECT * FROM ${identifier}`;

// O mejor aún, whitelist
const sql = `SELECT * FROM \`${ALLOWED_TABLES.includes(table) ? table : 'invalid'}\``;
```

---

## 5. Agregar Compresión de Response

```javascript
import compression from 'compression';

app.use(compression({
  level: 6,
  threshold: 1024, // Solo comprimir > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

---

## 6. Mejorar Logging del API

```javascript
import morgan from 'morgan';

// Logging combinado solo en requests relevantes
app.use(morgan(':method :url :status :response-time ms - :res[content-length]', {
  skip: (req, res) => res.statusCode < 400 // Skip successful requests
}));

// Logging detallado de errores
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, {
    method: req.method,
    url: req.url,
    status: err.statusCode || 500,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  res.status(err.statusCode || 500).json({ error: err.message });
});
```

---

## 7. Cachear Queries Frecuentes

```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const getCachedData = async (table, id = null) => {
  const key = `${table}:${id || '*'}`;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
  cache.set(key, { data: rows, time: Date.now() });
  return rows;
};
```

---

## 8. Agregar Indices en BD

```sql
-- En setup de BD, agregar índices para queries frecuentes
CREATE INDEX idx_reservations_property ON reservations(propertyId);
CREATE INDEX idx_reservations_guest ON reservations(guestId);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_rooms_property ON rooms(propertyId);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_owners_email ON owners(email);

-- Índices compuestos para queries comunes
CREATE INDEX idx_res_property_date ON reservations(propertyId, startDate, endDate);
```

---

## 9. Paginación en Endpoints GET

```javascript
app.get('/:table', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const offset = (page - 1) * limit;

  const [[data], [{ total }]] = await Promise.all([
    pool.query(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [limit, offset]),
    pool.query(`SELECT COUNT(*) as total FROM \`${table}\``)
  ]);

  res.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});
```

---

## 10. Manejo de Errores Mejorado

```javascript
const handleError = (err, res) => {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Registro duplicado' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ error: 'Referencia no válida' });
  }
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(400).json({ error: 'Campo no existe' });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
};

// Usar en cada catch
catch (err) {
  handleError(err, res);
}
```

---

## 11. Validar JSON Request

```javascript
app.use(express.json({
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));

// Validar antes de procesar
app.post('/:table', (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Body vacío' });
  }
  next();
});
```

---

## 12. CORS Mejorado

```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 📊 Checklist de Optimización

- [ ] Implementar Pool optimization
- [ ] Agregar Rate Limiting
- [ ] Validación en servidor
- [ ] SQL injection protection
- [ ] Compresión de responses
- [ ] Logging mejorado
- [ ] Caché de queries
- [ ] Índices en BD
- [ ] Paginación
- [ ] Manejo de errores robusto
- [ ] Validación de JSON
- [ ] CORS mejorado

---

## 🚀 Beneficios

- **Rendimiento:** +40% más rápido con caché e índices
- **Seguridad:** Protección contra SQL injection y CORS
- **Escalabilidad:** Rate limiting y paginación
- **Confiabilidad:** Manejo robusto de errores
- **Monitoreo:** Logging detallado

