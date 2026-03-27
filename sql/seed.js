// sql/seed.js
// Inserts demo data for local development.
// Usage: npm run db:seed

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { pool } = require('../src/config/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Admin user
    const hash = await bcrypt.hash('password123', 10);
    const adminId = uuid();
    await client.query(`
      INSERT INTO users (id, name, email, password, role)
      VALUES ($1, 'Admin User', 'admin@vendoros.com', $2, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [adminId, hash]);

    // Fetch category ids
    const { rows: cats } = await client.query('SELECT id, name FROM categories');
    const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

    // Vendors
    const vendors = [
      { name: 'Summit AV Productions',  cat: 'Audio/Visual',    email: 'contact@summitav.com',   phone: '+1 555-0101', status: 'active',    notes: 'Preferred AV partner.' },
      { name: 'Bloom & Wild Florals',   cat: 'Florals',         email: 'hello@bloomwild.co',      phone: '+1 555-0202', status: 'active',    notes: 'Premium floral arrangements.' },
      { name: 'Metro Catering Co.',     cat: 'Catering',        email: 'orders@metrocatering.com',phone: '+1 555-0303', status: 'pending',   notes: 'Awaiting health cert renewal.' },
      { name: 'Lense & Light Studio',   cat: 'Photography',     email: 'shoot@lenselight.io',     phone: '+1 555-0404', status: 'completed', notes: 'Contract closed.' },
      { name: 'SoundWave Entertainment',cat: 'Entertainment',   email: 'book@soundwave.com',      phone: '+1 555-0505', status: 'active',    notes: 'DJ and live band agency.' },
      { name: 'EliteTransport Group',   cat: 'Transportation',  email: 'fleet@elitetransport.net',phone: '+1 555-0606', status: 'pending',   notes: 'Negotiating fleet rates.' },
    ];
    const vendorIds = [];
    for (const v of vendors) {
      const id = uuid();
      vendorIds.push(id);
      await client.query(`
        INSERT INTO vendors (id, name, category_id, email, phone, status, notes, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (email) DO NOTHING
      `, [id, v.name, catMap[v.cat], v.email, v.phone, v.status, v.notes, adminId]);
    }

    // Events
    const events = [
      { name: 'Annual Gala 2025',     date: '2025-03-15', location: 'Grand Ballroom' },
      { name: 'Tech Summit Q1',       date: '2025-02-08', location: 'Convention Center' },
      { name: 'Product Launch Night', date: '2025-04-22', location: 'Rooftop Venue' },
    ];
    const eventIds = [];
    for (const e of events) {
      const id = uuid();
      eventIds.push(id);
      await client.query(`
        INSERT INTO events (id, name, event_date, location, created_by)
        VALUES ($1,$2,$3,$4,$5)
      `, [id, e.name, e.date, e.location, adminId]);
    }

    // Assignments: vendor[0,1,3] → event[0]; vendor[0,2] → event[1]; vendor[2,4] → event[2]
    const assignments = [
      [vendorIds[0], eventIds[0]], [vendorIds[1], eventIds[0]], [vendorIds[3], eventIds[0]],
      [vendorIds[0], eventIds[1]], [vendorIds[2], eventIds[1]],
      [vendorIds[2], eventIds[2]], [vendorIds[4], eventIds[2]],
    ];
    for (const [vid, eid] of assignments) {
      await client.query(
        'INSERT INTO vendor_events (vendor_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [vid, eid]
      );
    }

    await client.query('COMMIT');
    console.log('✅  Seed complete. Login: admin@vendoros.com / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
