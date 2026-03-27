// src/config/db.js
// PostgreSQL connection pool via node-postgres (pg)

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                  // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Simple helper – runs a parameterised query and returns rows
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
