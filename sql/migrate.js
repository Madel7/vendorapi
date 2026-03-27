// sql/migrate.js
// Runs schema.sql against the configured database.
// Usage: npm run db:migrate

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('⏳  Running migrations…');
  try {
    await pool.query(sql);
    console.log('✅  Migration complete.');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
