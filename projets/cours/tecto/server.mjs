/**
 * Production server with auto-persisted users.json
 * Usage: npm run build && npm start
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const PUBLIC_USERS = path.join(ROOT, 'public', 'users.json');
const DATA_USERS = path.join(ROOT, 'data', 'users.json');
const PORT = Number(process.env.PORT || 4173);

const DEFAULT = {
  version: 2,
  inviteCode: 'KU-FIRST-ACCESS',
  users: [],
};

function readUsers() {
  for (const file of [DATA_USERS, PUBLIC_USERS]) {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        return {
          version: 2,
          inviteCode: raw.inviteCode || DEFAULT.inviteCode,
          users: Array.isArray(raw.users) ? raw.users : [],
        };
      }
    } catch {
      /* */
    }
  }
  return { ...DEFAULT, users: [] };
}

function writeUsers(db) {
  const payload = JSON.stringify(
    {
      version: 2,
      inviteCode: db.inviteCode || DEFAULT.inviteCode,
      users: Array.isArray(db.users) ? db.users : [],
    },
    null,
    2
  );
  fs.mkdirSync(path.dirname(DATA_USERS), { recursive: true });
  fs.mkdirSync(path.dirname(PUBLIC_USERS), { recursive: true });
  fs.writeFileSync(DATA_USERS, payload, 'utf8');
  fs.writeFileSync(PUBLIC_USERS, payload, 'utf8');
  // also mirror into dist for static fetches
  try {
    const distUsers = path.join(DIST, 'users.json');
    fs.writeFileSync(distUsers, payload, 'utf8');
  } catch {
    /* */
  }
  return JSON.parse(payload);
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// seed
writeUsers(readUsers());

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/api/users') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'GET') {
        res.end(JSON.stringify(readUsers()));
        return;
      }
      if (req.method === 'POST' || req.method === 'PUT') {
        const body = await readBody(req);
        res.end(JSON.stringify(writeUsers(body)));
        return;
      }
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e?.message || e) }));
      return;
    }
  }

  // static from dist
  let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(DIST)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }
  try {
    const data = fs.readFileSync(filePath);
    res.setHeader('Content-Type', contentType(filePath));
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Knowledge Universe → http://localhost:${PORT}`);
  console.log(`Users API → http://localhost:${PORT}/api/users (auto-writes public/users.json)`);
});
