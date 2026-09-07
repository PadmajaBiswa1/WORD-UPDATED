const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// Store uploads in backend/public/uploads
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({ storage });

function safeExtFromMime(mime = '') {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mime] || 'png';
}

router.post('/image', upload.single('file'), (req, res) => { 
  // NOTE: Multer/busboy will handle multipart parsing. 
  // If the request body is malformed, the error is handled by Express error middleware.

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'file is required' });
    }

    // Basic allow-list by mimetype
    const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']);
    if (!allowed.has(req.file.mimetype)) {
      return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}` });
    }

    const ext = safeExtFromMime(req.file.mimetype);
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const outPath = path.join(UPLOAD_DIR, fileName);

    fs.writeFileSync(outPath, req.file.buffer);

    // server.js serves /uploads/* statically
    return res.json({
      url: `/uploads/${fileName}`,
      name: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    console.error('[upload/image] error:', err);
    return res.status(500).json({ message: 'Image upload failed', error: err?.message || 'Unknown error' });
  }
});

// General file upload endpoint (documents, pdf, docx, txt, csv, code, etc.)
router.post('/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'file is required' });
    }

    const rawExt = path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase();
    const safeExt = rawExt ? rawExt.replace(/[^a-z0-9_-]/g, '') : 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt || 'bin'}`;
    const outPath = path.join(UPLOAD_DIR, fileName);

    fs.writeFileSync(outPath, req.file.buffer);

    return res.json({
      url: `/uploads/${fileName}`,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    console.error('[upload/file] error:', err);
    return res.status(500).json({ message: 'File upload failed', error: err?.message || 'Unknown error' });
  }
});

module.exports = router;

