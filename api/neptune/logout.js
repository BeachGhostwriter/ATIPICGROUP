const { SESSION_COOKIE } = require('../../lib/neptune-auth');

module.exports = (req, res) => {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  );
  res.status(200).json({ ok: true });
};
