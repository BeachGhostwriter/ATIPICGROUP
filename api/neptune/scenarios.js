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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const pg = getPool();

  // Table may not exist yet if user has never saved a scenario
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
    `SELECT id, scenario_name, created_at, scenario_data, results
     FROM neptune_scenarios
     WHERE user_email = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [session.email]
  );

  return res.status(200).json({ scenarios: rows });
};
