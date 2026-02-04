const fs = require('fs');

const uploadCode = `
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

`;

let content = fs.readFileSync('api/server.js', 'utf8');
// Agregar import fs al principio si no existe
if (!content.includes("import fs from 'fs'")) {
  content = "import fs from 'fs';\n" + content;
}
content = content.replace(
  /app\.listen\(3003/,
  uploadCode + 'app.listen(3003'
);
fs.writeFileSync('api/server.js', content);
console.log('Upload routes added successfully');
