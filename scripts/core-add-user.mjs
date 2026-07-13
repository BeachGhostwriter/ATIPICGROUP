#!/usr/bin/env node
// Generates a SQL statement to add/update a Core portal user.
// Usage: node scripts/core-add-user.mjs --email=person@atipicgroup.com --password=ChangeMe123 --role=manager --name="Full Name"

import crypto from 'crypto';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [key, ...rest] = a.replace(/^--/, '').split('=');
    return [key, rest.join('=')];
  })
);

if (!args.email || !args.password) {
  console.error('Usage: node scripts/core-add-user.mjs --email=person@atipicgroup.com --password=ChangeMe123 --role=manager --name="Full Name"');
  process.exit(1);
}

const role = (args.role || 'viewer').toLowerCase();
if (!['manager', 'expert', 'viewer'].includes(role)) {
  console.error('Role must be one of: manager, expert, viewer');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(args.password, salt, 64).toString('hex');
const passwordHash = `${salt}:${hash}`;

const email = args.email.replace(/'/g, "''");
const safeRole = role.replace(/'/g, "''");
const name = args.name ? `'${args.name.replace(/'/g, "''")}'` : 'NULL';

console.log('-- Run this against your Core Postgres database (for example in Neon SQL editor):\n');
console.log(
  `INSERT INTO core_users (email, name, role, password_hash)\nVALUES ('${email}', ${name}, '${safeRole}', '${passwordHash}')\nON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = EXCLUDED.role;`
);
