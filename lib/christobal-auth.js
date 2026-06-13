const crypto = require('crypto');
const { Pool } = require('pg');

const SESSION_COOKIE = 'christobal_session';
const SESSION_TTL = 60 * 60 * 8; // 8 hours

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.CHRISTOBAL_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = String(stored).split(':');
  if (!salt || !hashHex) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const stored_buf = Buffer.from(hashHex, 'hex');
  if (stored_buf.length !== hash.length) return false;
  return crypto.timingSafeEqual(stored_buf, hash);
}

function signSession(email) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = `${email}.${exp}`;
  const sig = crypto.createHmac('sha256', process.env.CHRISTOBAL_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifySession(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const payload = Buffer.from(payloadB64, 'base64url').toString();
  const expectedSig = crypto.createHmac('sha256', process.env.CHRISTOBAL_SECRET).update(payload).digest('hex');
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
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  parseCookies,
  SESSION_COOKIE,
  SESSION_TTL,
};
