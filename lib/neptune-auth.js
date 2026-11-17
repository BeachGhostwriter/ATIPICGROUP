const crypto = require('crypto');
const { Pool } = require('pg');

const SESSION_COOKIE = 'neptune_session';
const SESSION_TTL = 60 * 60 * 8; // 8 hours

let pool;
function getPool() {
  if (!pool) {
    const connectionString =
      process.env.NEPTUNE_DATABASE_URL ||
      process.env.Neptune_database_url ||
      process.env.Neptune_Database_DATABASE_URL ||
      process.env.Neptune_Database_POSTGRES_URL;
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
  // The email itself contains dots, so the expiry is everything after the LAST dot.
  const cut = payload.lastIndexOf('.');
  if (cut <= 0) return null;
  const email = payload.slice(0, cut);
  const exp = Number(payload.slice(cut + 1));
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) return null;
  return email;
}

// ── Demo account (ring-fenced, read-only) ─────────────────────────────────────
// Shared with prospective clients. It can view and use every page of the app,
// but the server refuses any write (saving scenarios etc.) for this account.
const DEMO_EMAIL = 'demo@atipicgroup.com';
const DEMO_PASSWORD_HASH =
  '0f4b559da1e57d554efda1ccf091348f:81f42e2f0b6d6c31eabf7719f52d6e7eaa30253705459eadbe2287aedad6d8c2cc95ea0cd893575da2da9890b8d9314ba4a7de9b0840913506458badcef2e13a';

function isDemo(email) {
  return String(email || '').toLowerCase() === DEMO_EMAIL;
}

// Make sure the demo user row exists in the Neptune (Neon) database.
// Adapts to the live table's columns (the production table may differ from the seed script).
async function ensureDemoUser(pool) {
  const { rows: cols } = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'neptune_users'"
  );
  const have = new Set(cols.map((c) => c.column_name));
  const { rows: existing } = await pool.query(
    'SELECT 1 FROM neptune_users WHERE lower(email) = lower($1)', [DEMO_EMAIL]
  );
  if (existing.length) {
    await pool.query(
      'UPDATE neptune_users SET password_hash = $2 WHERE lower(email) = lower($1)',
      [DEMO_EMAIL, DEMO_PASSWORD_HASH]
    );
    return;
  }
  const names = ['email', 'password_hash'];
  const vals = [DEMO_EMAIL, DEMO_PASSWORD_HASH];
  if (have.has('name')) { names.push('name'); vals.push('Demo User (read-only)'); }
  if (have.has('role')) { names.push('role'); vals.push('viewer'); }
  const ph = vals.map((_, k) => '$' + (k + 1)).join(', ');
  await pool.query('INSERT INTO neptune_users (' + names.join(', ') + ') VALUES (' + ph + ')', vals);
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
  isDemo,
  ensureDemoUser,
  DEMO_EMAIL,
  SESSION_COOKIE,
  SESSION_TTL,
};