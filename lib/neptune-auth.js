const crypto = require('crypto');
const { Pool } = require('pg');

const SESSION_COOKIE = 'neptune_session';
const SESSION_TTL = 60 * 60 * 8; // 8 hours

let pool;
function getPool() {
  if (!pool) {
    const connectionString =
      process.env.NEPTUNE_DATABASE_URL ||
      process.env.Neptune_database_url;
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = String(stored).split(':');
  if (!salt || !hashHex) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (storedBuf.length !== hash.length) return false;
  return crypto.timingSafeEqual(storedBuf, hash);
}

function signSession(email) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = `${email}.${exp}`;
  const secret = process.env.NEPTUNE_AUTH_SECRET || process.env.Neptune_secret;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifySession(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const payload = Buffer.from(payloadB64, 'base64url').toString();
  const secret = process.env.NEPTUNE_AUTH_SECRET || process.env.Neptune_secret;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  const [email, exp] = payload.split('.');
  if (!exp || Date.now() / 1000 > Number(exp)) return null;
  return email;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

module.exports = {
  getPool,
  verifyPassword,
  signSession,
  verifySession,
  parseCookies,
  SESSION_COOKIE,
  SESSION_TTL,
};