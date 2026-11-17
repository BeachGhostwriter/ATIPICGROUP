'use strict';
const { getPool, verifySession, parseCookies, isDemo, SESSION_COOKIE } = require('../../lib/neptune-auth');

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS neptune_scenarios (
    id            SERIAL PRIMARY KEY,
    user_email    TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scenario_data JSONB,
    results       JSONB
  )`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const email = verifySession(cookies[SESSION_COOKIE]);
  if (!email) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  // Ring-fence: the shared demo account is read-only.
  if (isDemo(email)) {
    return res.status(403).json({ error: 'The demo account is read-only — scenarios cannot be saved.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { name, scenario_data, results } = body || {};
  if (!name) return res.status(400).json({ error: 'Scenario name required' });

  try {
    const pg = getPool();
    await pg.query(TABLE_SQL);
    const { rows } = await pg.query(
      `INSERT INTO neptune_scenarios (user_email, scenario_name, scenario_data, results)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [email, String(name).slice(0, 200), JSON.stringify(scenario_data || {}), JSON.stringify(results || {})]
    );
    return res.status(200).json({ ok: true, id: rows[0].id, created_at: rows[0].created_at });
  } catch (err) {
    console.error('Neptune save-scenario error:', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};
