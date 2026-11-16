import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT = {
  version: 2,
  inviteCode: 'KU-FIRST-ACCESS',
  users: [],
};
const ADMIN_EMAIL = 'Knowledge-Universe@proton.me';

function usersPaths(root) {
  return {
    publicFile: path.join(root, 'public', 'users.json'),
    dataFile: path.join(root, 'data', 'users.json'),
  };
}

function readUsers(root) {
  const { publicFile, dataFile } = usersPaths(root);
  for (const file of [dataFile, publicFile]) {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (raw && typeof raw === 'object') {
          return {
            version: 2,
            inviteCode:
              typeof raw.inviteCode === 'string' && raw.inviteCode.trim()
                ? raw.inviteCode.trim()
                : DEFAULT.inviteCode,
            users: Array.isArray(raw.users) ? raw.users : [],
          };
        }
      }
    } catch {
      /* try next */
    }
  }
  return { ...DEFAULT, users: [] };
}

function writeUsers(root, db) {
  const { publicFile, dataFile } = usersPaths(root);
  const payload = JSON.stringify(
    {
      version: 2,
      inviteCode: db.inviteCode || DEFAULT.inviteCode,
      users: Array.isArray(db.users) ? db.users : [],
    },
    null,
    2
  );
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.mkdirSync(path.dirname(publicFile), { recursive: true });
  fs.writeFileSync(dataFile, payload, 'utf8');
  fs.writeFileSync(publicFile, payload, 'utf8');
  return JSON.parse(payload);
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
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

function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

// In-memory reset tokens for dev (mirrors api/reset-password/*)
const RESET_TTL_MS = 15 * 60 * 1000;
let resetTokens = []; // {email, token, expiresAt, createdAt}
function cleanTokens() {
  const now = Date.now();
  resetTokens = resetTokens.filter(t => t.expiresAt > now);
}
function loadResetTokens() { cleanTokens(); return [...resetTokens]; }
function saveResetTokens(list) { resetTokens = list; }

async function handleResetRequest(req, res, root) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  if (!email || !isValidEmail(email)) return sendJson(res, 400, { error: 'E-mail invalide.' });
  const db = readUsers(root);
  const exists = db.users.some(u => (u.email || '').toLowerCase() === email);
  if (!exists) return sendJson(res, 404, { error: 'Aucun compte avec cet e-mail. Ajoute-le d’abord dans Compte → Identité.' });
  const token = 'KU-RESET-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const now = Date.now();
  let list = loadResetTokens().filter(t => t.email !== email);
  const expiresAt = now + RESET_TTL_MS;
  list.push({ email, token, createdAt: now, expiresAt });
  saveResetTokens(list);
  try {
    const inboxPath = path.join(root, '.tmp-ku-admin-inbox.json');
    let inbox = [];
    try { if (fs.existsSync(inboxPath)) inbox = JSON.parse(fs.readFileSync(inboxPath,'utf8')); } catch {}
    inbox.unshift({ to: ADMIN_EMAIL, userEmail: email, token, expiresAt, createdAt: now });
    if (inbox.length > 100) inbox = inbox.slice(0, 100);
    fs.mkdirSync(path.dirname(inboxPath), { recursive: true });
    fs.writeFileSync(inboxPath, JSON.stringify(inbox, null, 2),'utf8');
  } catch {}
  console.info(`[KU dev] Reset token for ${email}: ${token} (admin copy → ${ADMIN_EMAIL}, valide 15 min)`);
  return sendJson(res, 200, { message: `Code envoyé à ${email} (copie admin à ${ADMIN_EMAIL} — démo : affiché ci-dessous).`, token, adminCopy: ADMIN_EMAIL, expiresIn: RESET_TTL_MS });
}

async function handleResetConfirm(req, res, root) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const token = String(body.token || '').trim().toUpperCase();
  const newPassword = String(body.newPassword || '');
  if (!email || !isValidEmail(email)) return sendJson(res, 400, { error: 'E-mail invalide.' });
  if (!token) return sendJson(res, 400, { error: 'Code requis.' });
  if (newPassword.length < 6) return sendJson(res, 400, { error: '6 caractères minimum.' });
  let list = loadResetTokens();
  const idx = list.findIndex(t => t.email === email && String(t.token).toUpperCase() === token);
  if (idx < 0) return sendJson(res, 400, { error: 'Code invalide ou expiré. Redemande un code.' });
  const entry = list[idx];
  if (entry.expiresAt < Date.now()) {
    list.splice(idx, 1); saveResetTokens(list);
    return sendJson(res, 400, { error: 'Code expiré (15 min). Redemande un code.' });
  }
  const db = readUsers(root);
  // reset TOUS les comptes partageant cet e-mail
  const matchingIdxs = db.users.map((u,i)=> (u.email||'').toLowerCase()===email ? i : -1).filter(i=>i>=0);
  if (matchingIdxs.length===0) return sendJson(res, 404, { error: 'Compte introuvable.' });
  const enc = new TextEncoder();
  const subtle = crypto.subtle || (await import('node:crypto')).webcrypto.subtle;
  const fromHex = (hex) => { const out = new Uint8Array(hex.length/2); for(let i=0;i<out.length;i++) out[i]=parseInt(hex.slice(i*2,i*2+2),16); return out.buffer; };
  const toHex = (buf) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  for (const uIdx of matchingIdxs) {
    const salt = crypto.randomBytes(16).toString('hex');
    const keyMaterial = await subtle.importKey('raw', enc.encode(newPassword), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name:'PBKDF2', salt: fromHex(salt), iterations: 120000, hash:'SHA-256' }, keyMaterial, 256);
    const passwordHash = toHex(bits);
    db.users[uIdx] = { ...db.users[uIdx], salt, passwordHash, updatedAt: new Date().toISOString() };
  }
  writeUsers(root, db);
  list.splice(idx, 1); saveResetTokens(list);
  return sendJson(res, 200, { ok: true, message: matchingIdxs.length>1 ? `Mot de passe réinitialisé pour ${matchingIdxs.length} comptes.` : 'Mot de passe réinitialisé.' });
}

/**
 * Dev + preview middleware: /api/users + /api/reset-password/*
 * Writes instantly to public/users.json AND data/users.json
 */
export function usersApiPlugin() {
  return {
    name: 'ku-users-api',
    configureServer(server) {
      const root = server.config.root;
      const cur = readUsers(root);
      writeUsers(root, cur);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        // reset-password dev routes
        if (url === '/api/reset-password/request' && req.method === 'POST') {
          try { await handleResetRequest(req, res, root); } catch (e) { sendJson(res, 500, { error: String(e?.message || e) }); }
          return;
        }
        if (url === '/api/reset-password/confirm' && req.method === 'POST') {
          try { await handleResetConfirm(req, res, root); } catch (e) { sendJson(res, 500, { error: String(e?.message || e) }); }
          return;
        }
        if (url !== '/api/users') return next();
        try {
          if (req.method === 'GET') return sendJson(res, 200, readUsers(root));
          if (req.method === 'PUT' || req.method === 'POST') {
            const body = await readBody(req);
            const nextDb = writeUsers(root, { version: 2, inviteCode: body.inviteCode, users: body.users });
            return sendJson(res, 200, nextDb);
          }
          if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
          return sendJson(res, 405, { error: 'Method not allowed' });
        } catch (e) { return sendJson(res, 500, { error: String(e?.message || e) }); }
      });
    },
    configurePreviewServer(server) {
      const root = server.config.root;
      const cur = readUsers(root);
      writeUsers(root, cur);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/reset-password/request' && req.method === 'POST') {
          try { await handleResetRequest(req, res, root); } catch (e) { sendJson(res, 500, { error: String(e?.message || e) }); }
          return;
        }
        if (url === '/api/reset-password/confirm' && req.method === 'POST') {
          try { await handleResetConfirm(req, res, root); } catch (e) { sendJson(res, 500, { error: String(e?.message || e) }); }
          return;
        }
        if (url !== '/api/users') return next();
        try {
          if (req.method === 'GET') return sendJson(res, 200, readUsers(root));
          if (req.method === 'PUT' || req.method === 'POST') {
            const body = await readBody(req);
            return sendJson(res, 200, writeUsers(root, body));
          }
          if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
          return sendJson(res, 405, { error: 'Method not allowed' });
        } catch (e) { return sendJson(res, 500, { error: String(e?.message || e) }); }
      });
    },
  };
}
