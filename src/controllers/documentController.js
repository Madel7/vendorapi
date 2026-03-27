// src/controllers/documentController.js

const path = require('path');
const fs   = require('fs');
const { query } = require('../config/db');

// ── POST /api/vendors/:vendorId/documents ─────────────────────
const upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { vendorId } = req.params;
    const { doc_type = 'document' } = req.body;

    // Verify vendor exists
    const vendor = await query('SELECT id FROM vendors WHERE id=$1', [vendorId]);
    if (!vendor.rows[0]) {
      fs.unlinkSync(req.file.path); // clean up
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const { rows } = await query(
      `INSERT INTO documents (vendor_id, name, file_path, file_size, mime_type, doc_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        vendorId,
        req.file.originalname,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        doc_type,
        req.user.id,
      ]
    );
    res.status(201).json({ document: rows[0] });
  } catch (err) { next(err); }
};

// ── GET /api/vendors/:vendorId/documents ──────────────────────
const list = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM documents WHERE vendor_id=$1 ORDER BY uploaded_at DESC',
      [req.params.vendorId]
    );
    res.json({ documents: rows });
  } catch (err) { next(err); }
};

// ── GET /api/documents/:id/download ──────────────────────────
const download = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });

    const filePath = path.resolve(process.env.UPLOAD_DIR || 'uploads', rows[0].file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk.' });
    }
    res.download(filePath, rows[0].name);
  } catch (err) { next(err); }
};

// ── DELETE /api/documents/:id ─────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM documents WHERE id=$1 RETURNING file_path', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });

    // Delete physical file (non-blocking)
    const filePath = path.resolve(process.env.UPLOAD_DIR || 'uploads', rows[0].file_path);
    fs.unlink(filePath, () => {});

    res.json({ message: 'Document deleted.' });
  } catch (err) { next(err); }
};

module.exports = { upload, list, download, remove };
