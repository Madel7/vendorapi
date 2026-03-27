// src/controllers/eventController.js

const { query } = require('../config/db');

// ── GET /api/events ────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT e.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', v.id, 'name', v.name, 'status', v.status, 'category', c.name
        )) FILTER (WHERE v.id IS NOT NULL), '[]') AS vendors
      FROM events e
      LEFT JOIN vendor_events ve ON ve.event_id = e.id
      LEFT JOIN vendors v ON v.id = ve.vendor_id
      LEFT JOIN categories c ON c.id = v.category_id
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `);
    res.json({ events: rows });
  } catch (err) { next(err); }
};

// ── GET /api/events/:id ────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT e.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', v.id, 'name', v.name, 'status', v.status, 'category', c.name, 'email', v.email
        )) FILTER (WHERE v.id IS NOT NULL), '[]') AS vendors
      FROM events e
      LEFT JOIN vendor_events ve ON ve.event_id = e.id
      LEFT JOIN vendors v ON v.id = ve.vendor_id
      LEFT JOIN categories c ON c.id = v.category_id
      WHERE e.id = $1
      GROUP BY e.id
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event: rows[0] });
  } catch (err) { next(err); }
};

// ── POST /api/events ───────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { name, event_date, location, description } = req.body;
    const { rows } = await query(
      `INSERT INTO events (name, event_date, location, description, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, event_date, location || null, description || null, req.user.id]
    );
    res.status(201).json({ event: rows[0] });
  } catch (err) { next(err); }
};

// ── PATCH /api/events/:id ──────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { name, event_date, location, description } = req.body;
    const { id } = req.params;
    const { rows } = await query(`
      UPDATE events SET
        name        = COALESCE($1, name),
        event_date  = COALESCE($2, event_date),
        location    = COALESCE($3, location),
        description = COALESCE($4, description)
      WHERE id = $5 RETURNING *
    `, [name, event_date, location, description, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event: rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE /api/events/:id ─────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM events WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Event not found.' });
    res.json({ message: 'Event deleted.' });
  } catch (err) { next(err); }
};

// ── PUT /api/events/:id/vendors  (bulk assign) ─────────────────
const assignVendors = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vendor_ids = [] } = req.body;   // array of vendor UUIDs

    const client = await require('../config/db').pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM vendor_events WHERE event_id = $1', [id]);
      for (const vid of vendor_ids) {
        await client.query(
          'INSERT INTO vendor_events (vendor_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [vid, id]
        );
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }

    res.json({ message: 'Vendors assigned.', count: vendor_ids.length });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, assignVendors };
