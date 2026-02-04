const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3003;

// Enable CORS
app.use(cors());
app.use(express.json());

// Base upload directory
const UPLOAD_BASE = '/opt/apps/roomflow-staging/uploads';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ownerId = req.params.ownerId;
    const ownerDir = path.join(UPLOAD_BASE, 'owners', ownerId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true });
    }
    cb(null, ownerDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${timestamp}_${safeName}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// Upload file for owner
app.post('/api/upload/owner/:ownerId', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }
    
    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date().toISOString(),
      path: `/uploads/owners/${req.params.ownerId}/${req.file.filename}`
    };
    
    res.json({ success: true, file: fileInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List files for owner
app.get('/api/files/owner/:ownerId', (req, res) => {
  try {
    const ownerId = req.params.ownerId;
    const ownerDir = path.join(UPLOAD_BASE, 'owners', ownerId);
    
    if (!fs.existsSync(ownerDir)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(ownerDir).map(filename => {
      const filePath = path.join(ownerDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename: filename,
        size: stats.size,
        uploadDate: stats.mtime.toISOString(),
        path: `/uploads/owners/${ownerId}/${filename}`
      };
    });
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
app.delete('/api/files/owner/:ownerId/:filename', (req, res) => {
  try {
    const { ownerId, filename } = req.params;
    const filePath = path.join(UPLOAD_BASE, 'owners', ownerId, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
