/**
 * POST /api/reset-password/request  { email }
 * Generates a one-time token (15 min), stores in /tmp + memory.
 * Envoie aussi une copie à Knowledge-Universe@proton.me (admin).
 */
import fs from 'node:fs';
import path from 'node:path';

const TMP = '/tmp/ku-reset-tokens.json';
const TTL_MS = 15 * 60 * 1000;
const ADMIN_EMAIL = 'Knowledge-Universe@proton.me';

function readTokens() {
  try { if (fs.existsSync(TMP)) return JSON.parse(fs.readFileSync(TMP,'utf8')); } catch {}
  if (globalThis.__kuResetTokens) return globalThis.__kuResetTokens;
  return [];
}
function writeTokens(list) {
  globalThis.__kuResetTokens = list;
  try { fs.writeFileSync(TMP, JSON.stringify(list, null, 2),'utf8'); } catch {}
}
function normalizeEmail(e){ return String(e||'').trim().toLowerCase(); }
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

async function notifyAdmin({ userEmail, token, expiresAt }) {
  const subject = `[Knowledge Universe] Code de réinitialisation pour ${userEmail}`;
  const text = `Demande de réinitialisation\n\nUtilisateur: ${userEmail}\nCode: ${token}\nExpire: ${new Date(expiresAt).toISOString()} (15 min)\n\nCe message est une copie admin envoyée à ${ADMIN_EMAIL}.`;
  // Production: décommente pour vrai envoi via Resend si RESEND_API_KEY est défini
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_KEY || '';
  if (apiKey) {
    try {
      // Exemple Resend — remplace par ton provider
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Knowledge Universe <noreply@knowledge-universe.app>', to: [ADMIN_EMAIL], subject, text }),
      });
      console.info(`[KU] Admin notified via Resend → ${ADMIN_EMAIL}`);
    } catch (e) { console.warn('[KU] Resend failed, fallback log', e); }
  }
  // Fallback log + persistance admin-inbox pour debug
  console.info(`[KU] ADMIN COPY → ${ADMIN_EMAIL} | ${subject} | ${token}`);
  try {
    const inboxPath = '/tmp/ku-admin-inbox.json';
    let inbox = [];
    try { if (fs.existsSync(inboxPath)) inbox = JSON.parse(fs.readFileSync(inboxPath,'utf8')); } catch {}
    inbox.unshift({ to: ADMIN_EMAIL, userEmail, token, expiresAt, createdAt: Date.now(), subject, text });
    if (inbox.length > 200) inbox = inbox.slice(0, 200);
    try { fs.writeFileSync(inboxPath, JSON.stringify(inbox, null, 2),'utf8'); } catch {}
    globalThis.__kuAdminInbox = inbox;
  } catch {}
}

export default async function handler(req, res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){ res.status(204).end(); return; }
  if(req.method!=='POST'){ res.status(405).json({error:'Method not allowed'}); return; }
  try{
    const body = typeof req.body==='string' ? JSON.parse(req.body||'{}') : req.body||{};
    const email = normalizeEmail(body.email);
    if(!email || !isValidEmail(email)){ res.status(400).json({error:'E-mail invalide.'}); return; }
    let users = [];
    try{
      const { readFileSync, existsSync } = fs;
      const candidates=[path.join(process.cwd(),'public','users.json'),path.join(process.cwd(),'data','users.json'),'/tmp/ku-users.json'];
      for(const f of candidates){ if(existsSync(f)){ try{ users=JSON.parse(readFileSync(f,'utf8')).users||[]; if(users.length) break;}catch{}} }
      if(!users.length && globalThis.__kuUsersDb) users=globalThis.__kuUsersDb.users||[];
    }catch{}
    const exists = users.some(u=> (u.email||'').toLowerCase()===email );
    if(!exists){ res.status(404).json({error:'Aucun compte avec cet e-mail. Vérifie l’orthographe ou ajoute l’e-mail dans Compte → Identité.'}); return; }
    const { randomBytes } = await import('node:crypto');
    const token = 'KU-RESET-' + randomBytes(3).toString('hex').toUpperCase();
    const now=Date.now();
    const expiresAt = now+TTL_MS;
    let list = readTokens().filter(t=> t.expiresAt>now && t.email!==email);
    list.push({email, token, createdAt: now, expiresAt});
    writeTokens(list);
    // Notifie l’admin en arrière-plan (ne bloque pas la réponse)
    void notifyAdmin({ userEmail: email, token, expiresAt }).catch(()=>{});
    res.status(200).json({message:`Code envoyé à ${email} (copie admin à ${ADMIN_EMAIL}). En démo : code ci-dessous.`, token, expiresIn: TTL_MS, adminCopy: ADMIN_EMAIL});
  }catch(e){ res.status(500).json({error:String(e?.message||e)}); }
}
