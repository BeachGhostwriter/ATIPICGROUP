const { getPool, verifyPassword, signSession, SESSION_COOKIE, SESSION_TTL } = require('../../lib/core-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }

  const email = ((body && body.email) || '').trim();
  const password = (body && body.password) || '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT email, password_hash, role FROM core_users WHERE lower(email) = lower($1)',
      [email]
    );
    const user = rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signSession(user.email);
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`
    );
    res.status(200).json({ ok: true, role: user.role || 'viewer' });
  } catch (err) {
    console.error('Core login error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};
