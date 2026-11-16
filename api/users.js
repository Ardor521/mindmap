/**
 * Vercel Serverless — users DB.
 * Persistence tiers:
 * 1) /tmp (warm instances)
 * 2) In-memory global (same isolate)
 * Seeded from bundled public/users.json on first read when empty.
 *
 * For durable multi-instance production, set a real DB later.
 * Local/dev uses the Vite plugin which writes public/users.json instantly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT = {
  version: 2,
  inviteCode: 'KU-FIRST-ACCESS',
  users: [],
};

const TMP = '/tmp/ku-users.json';

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT, users: [] };
  return {
    version: 2,
    inviteCode:
      typeof raw.inviteCode === 'string' && raw.inviteCode.trim()
        ? raw.inviteCode.trim()
        : DEFAULT.inviteCode,
    users: Array.isArray(raw.users) ? raw.users : [],
  };
}

function readSeed() {
  try {
    // cwd on Vercel is project root / deployment
    const candidates = [
      path.join(process.cwd(), 'public', 'users.json'),
      path.join(process.cwd(), 'users.json'),
      path.join(process.cwd(), 'data', 'users.json'),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        return normalize(JSON.parse(fs.readFileSync(f, 'utf8')));
      }
    }
  } catch {
    /* */
  }
  return { ...DEFAULT, users: [] };
}

function readDb() {
  try {
    if (fs.existsSync(TMP)) {
      return normalize(JSON.parse(fs.readFileSync(TMP, 'utf8')));
    }
  } catch {
    /* */
  }
  if (globalThis.__kuUsersDb) return normalize(globalThis.__kuUsersDb);
  const seed = readSeed();
  globalThis.__kuUsersDb = seed;
  return seed;
}

function writeDb(db) {
  const next = normalize(db);
  globalThis.__kuUsersDb = next;
  try {
    fs.writeFileSync(TMP, JSON.stringify(next, null, 2), 'utf8');
  } catch {
    /* read-only fs */
  }
  return next;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      res.status(200).json(readDb());
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {};
      const saved = writeDb(body);
      res.status(200).json(saved);
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
