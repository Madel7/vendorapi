// src/controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../config/db');

// ── POST /api/auth/register ────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hash]
    );

    const user  = rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) { next(err); }
};

// ── POST /api/auth/login ───────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1', [email.toLowerCase()]
    );
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ───────────────────────────────────────────
const me = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
};

// ── Helpers ────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const sanitize = ({ id, name, email, role, created_at }) =>
  ({ id, name, email, role, created_at });

module.exports = { register, login, me };
