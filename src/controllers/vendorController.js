// src/controllers/vendorController.js

const { query } = require('../config/db');

// ── Shared SELECT with joins ───────────────────────────────────
const VENDOR_SELECT = `
  SELECT
    v.id, v.name, c.name AS category, v.email, v.phone,
    v.status, v.notes, v.created_at, v.updated_at,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id', ve.event_id, 'name', e.name, 'date', e.event_date, 'location', e.location
      )) FILTER (WHERE ve.event_id IS NOT NULL),
    '[]') AS assigned_events,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id', d.id, 'name', d.name, 'doc_type', d.doc_type,
        'file_size', d.file_size, 'mime_type', d.mime_type, 'uploaded_at', d.uploaded_at
      )) FILTER (WHERE d.id IS NOT NULL),
    '[]') AS documents
  FROM vendors v
  JOIN categories c ON c.id = v.category_id
  LEFT JOIN vendor_events ve ON ve.vendor_id = v.id
  LEFT JOIN events e ON e.id = ve.event_id
  LEFT JOIN documents d ON d.vendor_id = v.id
`;
const GROUP_BY = `GROUP BY v.id, c.name`;

// ── GET /api/vendors ───────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { status, category, search, event_id } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;

    if (status)    { conditions.push(`v.status = $${p++}`);           params.push(status); }
    if (category)  { conditions.push(`c.name ILIKE $${p++}`);         params.push(category); }
    if (search)    { conditions.push(`(v.name ILIKE $${p++} OR v.email ILIKE $${p++})`); params.push(`%${search}%`, `%${search}%`); p++; }
    if (event_id)  { conditions.push(`ve.event_id = $${p++}`);        params.push(event_id); }

    const WHERE = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `${VENDOR_SELECT} ${WHERE} ${GROUP_BY} ORDER BY v.created_at DESC`;
    const { rows } = await query(sql, params);
    res.json({ vendors: rows });
  } catch (err) { next(err); }
};

// ── GET /api/vendors/:id ───────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const { rows } = await query(
      `${VENDOR_SELECT} WHERE v.id = $1 ${GROUP_BY}`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Vendor not found.' });
    res.json({ vendor: rows[0] });
  } catch (err) { next(err); }
};

// ── POST /api/vendors ──────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { name, category, email, phone, status = 'pending', notes } = req.body;

    const { rows: cats } = await query('SELECT id FROM categories WHERE name = $1', [category]);
    if (!cats[0]) return res.status(400).json({ error: 'Invalid category.' });

    const { rows } = await query(
      `INSERT INTO vendors (name, category_id, email, phone, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, cats[0].id, email.toLowerCase(), phone || null, status, notes || null, req.user.id]
    );

    const { rows: result } = await query(
      `${VENDOR_SELECT} WHERE v.id = $1 ${GROUP_BY}`, [rows[0].id]
    );
    res.status(201).json({ vendor: result[0] });
  } catch (err) { next(err); }
};

// ── PATCH /api/vendors/:id ────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { name, category, email, phone, status, notes } = req.body;
    const { id } = req.params;

    const existing = await query('SELECT id FROM vendors WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Vendor not found.' });

    let catId = undefined;
    if (category) {
      const { rows } = await query('SELECT id FROM categories WHERE name = $1', [category]);
      if (!rows[0]) return res.status(400).json({ error: 'Invalid category.' });
      catId = rows[0].id;
    }

    // Build dynamic SET clause
    const fields = [];
    const params = [];
    let p = 1;
    if (name   !== undefined) { fields.push(`name=$${p++}`);        params.push(name); }
    if (catId  !== undefined) { fields.push(`category_id=$${p++}`); params.push(catId); }
    if (email  !== undefined) { fields.push(`email=$${p++}`);       params.push(email.toLowerCase()); }
    if (phone  !== undefined) { fields.push(`phone=$${p++}`);       params.push(phone); }
    if (status !== undefined) { fields.push(`status=$${p++}`);      params.push(status); }
    if (notes  !== undefined) { fields.push(`notes=$${p++}`);       params.push(notes); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(id);
    await query(`UPDATE vendors SET ${fields.join(',')} WHERE id=$${p}`, params);

    const { rows } = await query(`${VENDOR_SELECT} WHERE v.id=$1 ${GROUP_BY}`, [id]);
    res.json({ vendor: rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/vendors/:id ───────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM vendors WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Vendor not found.' });
    res.json({ message: 'Vendor deleted.' });
  } catch (err) { next(err); }
};

// ── GET /api/vendors/stats ────────────────────────────────────
const stats = async (req, res, next) => {
  try {
    const { rows: statusCounts } = await query(`
      SELECT status, COUNT(*)::int AS count FROM vendors GROUP BY status
    `);
    const { rows: catCounts } = await query(`
      SELECT c.name AS category, COUNT(v.id)::int AS count
      FROM categories c LEFT JOIN vendors v ON v.category_id = c.id
      GROUP BY c.name ORDER BY count DESC
    `);
    const { rows: total } = await query('SELECT COUNT(*)::int AS total FROM vendors');
    res.json({ total: total[0].total, by_status: statusCounts, by_category: catCounts });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, stats };
