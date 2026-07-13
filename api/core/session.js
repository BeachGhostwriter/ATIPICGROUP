const { verifySession, parseCookies, SESSION_COOKIE } = require('../../lib/core-auth');

module.exports = (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const email = verifySession(cookies[SESSION_COOKIE]);

  if (email) {
    res.status(200).json({ authenticated: true, email });
  } else {
    res.status(200).json({ authenticated: false });
  }
};
