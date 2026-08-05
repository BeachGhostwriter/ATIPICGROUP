const { requireConfig, verifySession, parseCookies, SESSION_COOKIE } = require('../lib/neptune-auth');

module.exports = (req, res) => {
  const config = requireConfig();
  if (!config) {
    res.status(500).json({ error: 'Neptune auth is not configured on the server.' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const email = verifySession(cookies[SESSION_COOKIE]);

  if (email) {
    res.status(200).json({ authenticated: true, email });
  } else {
    res.status(200).json({ authenticated: false });
  }
};
