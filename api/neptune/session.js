const { verifySession, parseCookies, isDemo, SESSION_COOKIE } = require('../../lib/neptune-auth');

module.exports = (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const email = verifySession(cookies[SESSION_COOKIE]);

  if (email) {
    res.status(200).json({ authenticated: true, email, demo: isDemo(email), readOnly: isDemo(email) });
  } else {
    res.status(200).json({ authenticated: false });
  }
};
