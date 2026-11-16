/**
 * Auth: pseudo + mot de passe, fichier users.json, code d'invitation unique.
 * Migre automatiquement les anciennes bases (email / v1).
 */

import { fetchUsersRemote, pushUsersRemote } from './usersRemote';

const DB_KEY = 'ku:users-db-v2';
const DB_KEY_LEGACY = 'ku:users-v1';
const SESSION_KEY = 'ku:session-v2';
const SESSION_KEY_LEGACY = 'ku:session-v1';
const PBKDF2_ITERS = 120_000;
/** Code par défaut tant qu'aucune rotation n'a eu lieu */
export const DEFAULT_INVITE_CODE = 'KU-FIRST-ACCESS';

export interface StoredUser {
  id: string;
  /** Identifiant de connexion (pseudo) */
  username: string;
  /** Ancien champ optionnel (migration) */
  email?: string;
  name: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  favoriteIcons: string[];
  shortcutsNote: string;
}

export interface UsersFile {
  version: 2;
  inviteCode: string;
  users: StoredUser[];
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  createdAt: string;
  favoriteIcons: string[];
  shortcutsNote: string;
}

export interface Session {
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): ArrayBuffer {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out.buffer;
}

function randomHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

export function generateInviteCode(): string {
  const part = () => randomHex(2).toUpperCase();
  return `KU-${part()}-${part()}`;
}

export function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
const RESET_TOKENS_KEY = 'ku:reset-tokens';
const RESET_TTL_MS = 15 * 60 * 1000;
type ResetEntry = { email: string; token: string; expiresAt: number; createdAt: number };
function loadResetEntries(): ResetEntry[] {
  try {
    const raw = localStorage.getItem(RESET_TOKENS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ResetEntry[];
    const now = Date.now();
    return Array.isArray(arr) ? arr.filter((e) => e.expiresAt > now) : [];
  } catch { return []; }
}
function saveResetEntries(list: ResetEntry[]) {
  try { localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(list)); } catch {}
}
function generateResetToken(): string {
  return `KU-RESET-${randomHex(3).toUpperCase()}`;
}

export function normalizeInviteCode(c: string): string {
  return String(c || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[_–—]/g, '-');
}

export function normalizeUsername(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32);
}

async function deriveKey(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex),
      iterations: PBKDF2_ITERS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(bits);
}

function emptyDb(): UsersFile {
  return { version: 2, inviteCode: DEFAULT_INVITE_CODE, users: [] };
}

function usernameFromLegacy(u: Record<string, unknown>): string {
  if (typeof u.username === 'string' && u.username.trim()) {
    return normalizeUsername(u.username);
  }
  if (typeof u.email === 'string' && u.email.trim()) {
    const local = u.email.split('@')[0] || u.email;
    return normalizeUsername(local);
  }
  if (typeof u.name === 'string' && u.name.trim()) {
    return normalizeUsername(u.name);
  }
  return normalizeUsername(`user_${randomHex(3)}`);
}

function normalizeUser(raw: unknown): StoredUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const username = usernameFromLegacy(u);
  if (!username || username.length < 2) return null;
  const salt = String(u.salt || '');
  const passwordHash = String(u.passwordHash || '');
  const rawEmail = typeof u.email === 'string' ? u.email.trim() : '';
  const email = rawEmail && isValidEmail(rawEmail) ? normalizeEmail(rawEmail) : undefined;
  // Keep users even without password hash so they appear in list (can't login until reset)
  return {
    id: String(u.id || `usr_${randomHex(8)}`),
    username,
    email,
    name: String(u.name || username),
    salt,
    passwordHash,
    createdAt: String(u.createdAt || new Date().toISOString()),
    updatedAt: String(u.updatedAt || u.createdAt || new Date().toISOString()),
    favoriteIcons: Array.isArray(u.favoriteIcons)
      ? (u.favoriteIcons as string[])
      : ['circle', 'sparkles', 'brain', 'atom', 'share-2'],
    shortcutsNote: String(u.shortcutsNote || ''),
  };
}

function normalizeDb(raw: unknown): UsersFile {
  if (!raw || typeof raw !== 'object') return emptyDb();
  const o = raw as Record<string, unknown>;

  // Legacy: plain array of users
  let usersRaw: unknown[] = [];
  if (Array.isArray(o)) {
    usersRaw = o as unknown[];
  } else if (Array.isArray(o.users)) {
    usersRaw = o.users;
  }

  const users: StoredUser[] = [];
  const seen = new Set<string>();
  for (const item of usersRaw) {
    const nu = normalizeUser(item);
    if (!nu) continue;
    if (seen.has(nu.username)) continue;
    seen.add(nu.username);
    users.push(nu);
  }

  let inviteCode = DEFAULT_INVITE_CODE;
  if (typeof o.inviteCode === 'string' && o.inviteCode.trim()) {
    inviteCode = o.inviteCode.trim();
  }

  return { version: 2, inviteCode, users };
}

function mergeUsers(base: UsersFile, extra: StoredUser[]): UsersFile {
  const map = new Map<string, StoredUser>();
  for (const u of base.users) map.set(u.username, u);
  for (const u of extra) {
    if (!map.has(u.username)) map.set(u.username, u);
  }
  return { ...base, users: [...map.values()] };
}

/** Read any known legacy storage keys */
function loadLegacyUsers(): StoredUser[] {
  const out: StoredUser[] = [];
  const keys = [DB_KEY_LEGACY, 'ku:users', 'ku:user-list'];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const u = normalizeUser(item);
          if (u) out.push(u);
        }
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.users)) {
        for (const item of parsed.users) {
          const u = normalizeUser(item);
          if (u) out.push(u);
        }
      }
    } catch {
      /* */
    }
  }
  return out;
}

export function loadUsersDb(): UsersFile {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = normalizeDb(JSON.parse(raw));
      // Always merge legacy so old accounts reappear
      const legacy = loadLegacyUsers();
      if (legacy.length) {
        const merged = mergeUsers(db, legacy);
        if (merged.users.length !== db.users.length) {
          saveUsersDb(merged);
          return merged;
        }
      }
      return db;
    }
  } catch {
    /* */
  }
  // No v2 yet — try legacy only
  const legacy = loadLegacyUsers();
  if (legacy.length) {
    const db = { version: 2 as const, inviteCode: DEFAULT_INVITE_CODE, users: legacy };
    saveUsersDb(db);
    return db;
  }
  return emptyDb();
}

export function saveUsersDb(db: UsersFile) {
  const normalized = normalizeDb(db);
  localStorage.setItem(DB_KEY, JSON.stringify(normalized));
  try {
    localStorage.setItem(`${DB_KEY}:updatedAt`, new Date().toISOString());
  } catch {
    /* */
  }
  // Fire-and-forget remote persist (Vite plugin writes public/users.json instantly)
  void pushUsersRemote(normalized).catch(() => {});
}

/** Awaitable save — use after register so file is written before continuing */
export async function saveUsersDbAsync(db: UsersFile): Promise<UsersFile> {
  const normalized = normalizeDb(db);
  localStorage.setItem(DB_KEY, JSON.stringify(normalized));
  try {
    localStorage.setItem(`${DB_KEY}:updatedAt`, new Date().toISOString());
  } catch {
    /* */
  }
  await pushUsersRemote(normalized);
  return normalized;
}

export function exportUsersFileJson(): string {
  return JSON.stringify(loadUsersDb(), null, 2);
}

export function downloadUsersFile(filename = 'users.json') {
  const json = exportUsersFileJson();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return json;
}

/**
 * Bootstrap:
 * 1) localStorage v2
 * 2) merge legacy accounts
 * 3) if still empty, seed from /users.json
 * Never invent a random invite code silently.
 */
export async function bootstrapUsersDb(): Promise<UsersFile> {
  // 1) Prefer shared API (auto-written public/users.json via Vite/server)
  const remote = await fetchUsersRemote();
  let local = loadUsersDb();

  if (remote) {
    // Merge remote + local so neither side loses accounts
    let merged = mergeUsers(remote, local.users);
    // Invite code: prefer remote (source of truth for single-use codes)
    merged.inviteCode = remote.inviteCode || local.inviteCode || DEFAULT_INVITE_CODE;
    // If local has more recent rotation with users, keep the longer user list invite from remote still
    localStorage.setItem(DB_KEY, JSON.stringify(normalizeDb(merged)));
    local = merged;
  } else if (local.users.length === 0) {
    // 2) Fallback static seed
    try {
      const res = await fetch(`/users.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const fileDb = normalizeDb(await res.json());
        local = mergeUsers(fileDb, local.users);
        if (!local.inviteCode) local.inviteCode = DEFAULT_INVITE_CODE;
        localStorage.setItem(DB_KEY, JSON.stringify(normalizeDb(local)));
      }
    } catch {
      /* */
    }
  }

  if (!local.inviteCode) local.inviteCode = DEFAULT_INVITE_CODE;
  if (!localStorage.getItem(DB_KEY)) {
    localStorage.setItem(DB_KEY, JSON.stringify(normalizeDb(local)));
  }

  // Migrate legacy session → v2
  try {
    if (!localStorage.getItem(SESSION_KEY)) {
      const legacySess = localStorage.getItem(SESSION_KEY_LEGACY);
      if (legacySess) localStorage.setItem(SESSION_KEY, legacySess);
    }
  } catch {
    /* */
  }

  return loadUsersDb();
}

export function importUsersFileJson(
  raw: string
): { ok: true; db: UsersFile } | { ok: false; error: string } {
  try {
    const incoming = normalizeDb(JSON.parse(raw));
    const current = loadUsersDb();
    // Merge: keep all users from both, prefer incoming invite code
    const merged = mergeUsers(incoming, current.users);
    merged.inviteCode = incoming.inviteCode || current.inviteCode || DEFAULT_INVITE_CODE;
    saveUsersDb(merged);
    return { ok: true, db: merged };
  } catch {
    return { ok: false, error: 'Fichier users invalide (JSON attendu).' };
  }
}

function toPublic(u: StoredUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    favoriteIcons: u.favoriteIcons ?? [],
    shortcutsNote: u.shortcutsNote ?? '',
  };
}

function createSession(userId: string): Session {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const session: Session = {
    userId,
    token: randomHex(24),
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY_LEGACY);
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.userId || !s?.expiresAt) return null;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      logoutUser();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function getCurrentUser(): PublicUser | null {
  const session = getSession();
  if (!session) return null;
  const db = loadUsersDb();
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    logoutUser();
    return null;
  }
  return toPublic(user);
}

export function getInviteCode(): string {
  return loadUsersDb().inviteCode || DEFAULT_INVITE_CODE;
}

export async function registerUser(input: {
  username: string;
  email?: string;
  password: string;
  inviteCode: string;
}): Promise<
  | { ok: true; user: PublicUser; session: Session; nextInviteCode: string }
  | { ok: false; error: string }
> {
  // Ensure DB is initialized (no random invite)
  let db = loadUsersDb();
  if (!localStorage.getItem(DB_KEY)) {
    db = await bootstrapUsersDb();
  }

  const username = normalizeUsername(input.username);
  const rawEmail = (input.email || '').trim();
  const email = rawEmail ? normalizeEmail(rawEmail) : undefined;
  const code = normalizeInviteCode(input.inviteCode);
  const expected = normalizeInviteCode(db.inviteCode || DEFAULT_INVITE_CODE);

  if (username.length < 2) {
    return { ok: false, error: 'Pseudo : 2 caractères minimum (lettres, chiffres, . _ -).' };
  }
  if (email && !isValidEmail(email)) {
    return { ok: false, error: 'E-mail : adresse invalide.' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: 'Mot de passe : 6 caractères minimum.' };
  }
  if (!code) {
    return { ok: false, error: 'Code d’invitation requis.' };
  }
  if (code !== expected) {
    return {
      ok: false,
      error: `Code d’invitation invalide ou déjà utilisé. (Le code actuel n’est plus « ${DEFAULT_INVITE_CODE} » s’il a déjà servi — exportez users.json depuis un compte admin ou importez le bon fichier.)`,
    };
  }
  if (db.users.some((u) => u.username === username)) {
    return { ok: false, error: 'Ce pseudo est déjà pris.' };
  }
  // E-mail partagé autorisé : plusieurs comptes peuvent avoir la même adresse (choix produit)

  const salt = randomHex(16);
  const passwordHash = await deriveKey(input.password, salt);
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: `usr_${randomHex(8)}`,
    username,
    email,
    name: input.username.trim() || username,
    salt,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    favoriteIcons: ['circle', 'sparkles', 'brain', 'atom', 'share-2'],
    shortcutsNote: '',
  };

  const nextInviteCode = generateInviteCode();
  db.users.push(user);
  db.inviteCode = nextInviteCode;
  // Persist locally + API (writes public/users.json automatically on server/dev)
  const pushed = await pushUsersRemote(normalizeDb(db));
  localStorage.setItem(DB_KEY, JSON.stringify(normalizeDb(db)));
  if (!pushed) {
    // Fallback download only if API unavailable
    try {
      downloadUsersFile('users.json');
    } catch {
      /* */
    }
  }

  const session = createSession(user.id);
  return { ok: true, user: toPublic(user), session, nextInviteCode };
}

export async function loginUser(
  usernameRaw: string,
  password: string
): Promise<{ ok: true; user: PublicUser; session: Session } | { ok: false; error: string }> {
  // Ensure migrations ran
  if (!localStorage.getItem(DB_KEY)) {
    await bootstrapUsersDb();
  } else {
    // Still merge legacy
    loadUsersDb();
  }

  const username = normalizeUsername(usernameRaw);
  // Also allow login with old email local-part or full email
  const rawLower = usernameRaw.trim().toLowerCase();
  const db = loadUsersDb();

  const user = db.users.find(
    (u) =>
      u.username === username ||
      u.username === rawLower ||
      (u.email && u.email.toLowerCase() === rawLower) ||
      (u.email && u.email.split('@')[0].toLowerCase() === username) ||
      u.name.toLowerCase() === rawLower
  );

  if (!user || !user.salt || !user.passwordHash) {
    return {
      ok: false,
      error:
        db.users.length === 0
          ? 'Aucun compte enregistré sur cet appareil. Créez-en un avec le code d’invitation, ou importez un users.json.'
          : 'Pseudo ou mot de passe incorrect.',
    };
  }

  const hash = await deriveKey(password, user.salt);
  if (hash !== user.passwordHash) {
    return { ok: false, error: 'Pseudo ou mot de passe incorrect.' };
  }

  const session = createSession(user.id);
  return { ok: true, user: toPublic(user), session };
}

export function updateCurrentUser(
  patch: Partial<Pick<StoredUser, 'name' | 'favoriteIcons' | 'shortcutsNote' | 'email'>>
): PublicUser | null {
  const session = getSession();
  if (!session) return null;
  const db = loadUsersDb();
  const idx = db.users.findIndex((u) => u.id === session.userId);
  if (idx < 0) return null;
  const normalizedPatch: typeof patch = { ...patch };
  if (normalizedPatch.email !== undefined) {
    const em = normalizeEmail(String(normalizedPatch.email));
    if (em && !isValidEmail(em)) return null;
    // E-mail partagé autorisé : pas de vérification de doublon
    normalizedPatch.email = em || undefined;
  }
  db.users[idx] = {
    ...db.users[idx],
    ...normalizedPatch,
    updatedAt: new Date().toISOString(),
  };
  saveUsersDb(db);
  return toPublic(db.users[idx]);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = getSession();
  if (!session) return { ok: false, error: 'Non connecté.' };
  if (newPassword.length < 6) return { ok: false, error: '6 caractères minimum.' };
  const db = loadUsersDb();
  const idx = db.users.findIndex((u) => u.id === session.userId);
  if (idx < 0) return { ok: false, error: 'Compte introuvable.' };
  const user = db.users[idx];
  const cur = await deriveKey(currentPassword, user.salt);
  if (cur !== user.passwordHash) return { ok: false, error: 'Mot de passe actuel incorrect.' };
  const salt = randomHex(16);
  const passwordHash = await deriveKey(newPassword, salt);
  db.users[idx] = { ...user, salt, passwordHash, updatedAt: new Date().toISOString() };
  saveUsersDb(db);
  return { ok: true };
}

export async function requestPasswordReset(
  emailRaw: string
): Promise<{ ok: true; message: string; token?: string } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!email || !isValidEmail(email)) return { ok: false, error: 'E-mail invalide.' };
  // local first: find all accounts sharing this e-mail (plusieurs comptes peuvent avoir le même e-mail)
  const db = loadUsersDb();
  const matching = db.users.filter((u) => u.email && normalizeEmail(u.email) === email);
  if (!matching.length) return { ok: false, error: 'Aucun compte avec cet e-mail.' };
  // try production API — on success let server handle multi-account email too
  try {
    const res = await fetch('/api/reset-password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      // server may return one token even for shared e-mail — that's ok
      return { ok: true, message: data.message || 'E-mail de réinitialisation envoyé.', token: data.token };
    }
    // if 404 on Vercel (function missing) fallback to local below
    if (res.status !== 404 && res.status !== 500) {
      const j = await res.json().catch(() => ({}));
      if (j.error) return { ok: false, error: j.error };
    }
  } catch {}
  // local fallback — one token shared for all accounts with same e-mail
  const token = generateResetToken();
  const entries = loadResetEntries().filter((e) => e.email !== email);
  entries.push({ email, token, createdAt: Date.now(), expiresAt: Date.now() + RESET_TTL_MS });
  saveResetEntries(entries);
  console.info('[KU] Reset token for', email, `(×${matching.length} compte(s))`, token);
  const who = matching.length > 1 ? `${matching.length} comptes` : matching[0].username;
  return { ok: true, message: `Code envoyé pour ${who} (démo : affiché ci-dessous). Vérifiez votre e-mail en production.`, token };
}

export async function resetPassword(
  emailRaw: string,
  tokenRaw: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  const token = String(tokenRaw || '').trim().toUpperCase();
  if (!email || !isValidEmail(email)) return { ok: false, error: 'E-mail invalide.' };
  if (!token) return { ok: false, error: 'Code requis.' };
  if (newPassword.length < 6) return { ok: false, error: '6 caractères minimum.' };
  // try production API first
  try {
    const res = await fetch('/api/reset-password/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, newPassword }),
    });
    if (res.ok) return { ok: true };
    if (res.status !== 404 && res.status !== 500) {
      const j = await res.json().catch(() => ({}));
      if (j.error) return { ok: false, error: j.error };
    }
  } catch {}
  // local fallback — update ALL accounts sharing this e-mail (puisqu'on autorise l'e-mail partagé)
  const entries = loadResetEntries();
  const idx = entries.findIndex((e) => e.email === email && e.token.toUpperCase() === token);
  if (idx < 0) return { ok: false, error: 'Code invalide ou expiré.' };
  const entry = entries[idx];
  if (entry.expiresAt < Date.now()) {
    entries.splice(idx, 1);
    saveResetEntries(entries);
    return { ok: false, error: 'Code expiré (15 min). Redemandez un code.' };
  }
  const db = loadUsersDb();
  const matchingIdxs = db.users
    .map((u, i) => (u.email && normalizeEmail(u.email) === email ? i : -1))
    .filter((i) => i >= 0);
  if (matchingIdxs.length === 0) return { ok: false, error: 'Compte introuvable.' };
  const salt = randomHex(16);
  const passwordHash = await deriveKey(newPassword, salt);
  const newSaltForEach = matchingIdxs.length === 1 ? salt : '';
  // Use same password for all sharing the e-mail — generate one hash then reuse with per-user salt for security
  for (const uIdx of matchingIdxs) {
    const s = newSaltForEach || randomHex(16);
    const h = newSaltForEach ? passwordHash : await deriveKey(newPassword, s);
    db.users[uIdx] = { ...db.users[uIdx], salt: s, passwordHash: h, updatedAt: new Date().toISOString() };
  }
  saveUsersDb(db);
  entries.splice(idx, 1);
  saveResetEntries(entries);
  return { ok: true };
}

export function setCurrentUserEmail(newEmail: string): { ok: true; user: PublicUser } | { ok: false; error: string } {
  const email = normalizeEmail(newEmail);
  if (!email || !isValidEmail(email)) return { ok: false, error: 'E-mail invalide.' };
  const session = getSession();
  if (!session) return { ok: false, error: 'Non connecté.' };
  const db = loadUsersDb();
  // E-mail partagé autorisé : pas de vérification de doublon
  const idx = db.users.findIndex((u) => u.id === session.userId);
  if (idx < 0) return { ok: false, error: 'Compte introuvable.' };
  db.users[idx] = { ...db.users[idx], email, updatedAt: new Date().toISOString() };
  saveUsersDb(db);
  const pub = toPublic(db.users[idx]);
  return { ok: true, user: pub };
}

export function listUsernames(): string[] {
  return loadUsersDb().users.map((u) => u.username);
}

/** @deprecated use listUsernames */
export function listUserEmails(): string[] {
  return listUsernames();
}

export function userDataKey(userId: string, key: string) {
  return `ku:u:${userId}:${key}`;
}

/** Debug snapshot for account page */
export function getUsersDbSnapshot(): UsersFile {
  return loadUsersDb();
}
