'use strict';
const { getPool, verifySession, parseCookies, isDemo, SESSION_COOKIE } = require('../../lib/neptune-auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const email = verifySession(cookies[SESSION_COOKIE]);
  if (!email) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  // Ring-fence: the demo account never reads from or writes to the database.
  if (isDemo(email)) {
    return res.status(200).json({ scenarios: [], readOnly: true });
  }

  try {
    const pg = getPool();
    await pg.query(`
      CREATE TABLE IF NOT EXISTS neptune_scenarios (
        id            SERIAL PRIMARY KEY,
        user_email    TEXT NOT NULL,
        scenario_name TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        scenario_data JSONB,
        results       JSONB
      )`);
    const { rows } = await pg.query(
      `SELECT id, scenario_name, created_at, scenario_data, results
       FROM neptune_scenarios
       WHERE user_email = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [email]
    );
    return res.status(200).json({ scenarios: rows });
  } catch (err) {
    console.error('Neptune scenarios error:', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};
