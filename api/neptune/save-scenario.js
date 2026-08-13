'use strict';
const { verifySession, parseCookies, SESSION_COOKIE } = require('../../lib/neptune-auth');
const { Pool } = require('@neondatabase/serverless');

let pool;
function getPool() {
  if (!pool) {
    const url = process.env.NEPTUNE_DATABASE_URL ||
                process.env.Neptune_database_url ||
                process.env.Neptune_Database_DATABASE_URL ||
                process.env.Neptune_Database_POSTGRES_URL;
    if (!url) throw new Error('No Neptune DB URL configured');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { name, scenario_data, results } = body || {};
  if (!name) return res.status(400).json({ error: 'Scenario name required' });

  const pg = getPool();
  await pg.query(`
    CREATE TABLE IF NOT EXISTS neptune_scenarios (
      id          SERIAL PRIMARY KEY,
      user_email  TEXT NOT NULL,
      scenario_name TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scenario_data JSONB,
      results     JSONB
    )
  `);

  const { rows } = await pg.query(
    `INSERT INTO neptune_scenarios (user_email, scenario_name, scenario_data, results)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [session.email, name, JSON.stringify(scenario_data || {}), JSON.stringify(results || {})]
  );

  return res.status(200).json({ ok: true, id: rows[0].id, created_at: rows[0].created_at });
};
