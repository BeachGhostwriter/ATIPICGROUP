const { requireConfig, getPool, verifyPassword, signSession, SESSION_COOKIE, SESSION_TTL } = require('../lib/neptune-auth');

function maskIdentifier(value) {
  const id = String(value || '').trim();
  if (!id) return 'empty';
  const [local = '', domain = ''] = id.split('@');
  if (!domain) {
    return `${local.slice(0, 2)}***`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

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

  const config = requireConfig();
  if (!config) {
    res.status(500).json({ error: 'Neptune auth is not configured on the server.' });
    return;
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT email, password_hash FROM neptune_users WHERE lower(email) = lower($1)',
      [email]
    );
    const user = rows[0];

    if (!user) {
      console.info('Neptune login denied: user_not_found', {
        identifier: maskIdentifier(email),
      });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!verifyPassword(password, user.password_hash)) {
      console.info('Neptune login denied: password_mismatch', {
        identifier: maskIdentifier(email),
      });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    console.info('Neptune login success', {
      identifier: maskIdentifier(user.email || email),
    });

    const token = signSession(user.email);
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Neptune login error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};
