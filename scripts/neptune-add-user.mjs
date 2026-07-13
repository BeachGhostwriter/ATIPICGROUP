#!/usr/bin/env node
// Generates a SQL statement to add/update a Neptune portal user.
// Usage: node scripts/neptune-add-user.mjs --email=person@atipicgroup.com --password=ChangeMe123 --name="Full Name"

import crypto from 'crypto';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [key, ...rest] = a.replace(/^--/, '').split('=');
    return [key, rest.join('=')];
  })
);

if (!args.email || !args.password) {
  console.error('Usage: node scripts/neptune-add-user.mjs --email=person@atipicgroup.com --password=ChangeMe123 --name="Full Name"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(args.password, salt, 64).toString('hex');
const passwordHash = `${salt}:${hash}`;

const email = args.email.replace(/'/g, "''");
const name = args.name ? `'${args.name.replace(/'/g, "''")}'` : 'NULL';

console.log('-- Run this against your Neptune Postgres database (for example in Neon SQL editor):\n');
console.log(
  `INSERT INTO neptune_users (email, name, password_hash)\nVALUES ('${email}', ${name}, '${passwordHash}')\nON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;`
);
