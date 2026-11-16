/**
 * POST /api/reset-password/confirm  { email, token, newPassword }
 * Validates token (15 min) and resets password via PBKDF2.
 * Supporte plusieurs comptes partageant le même e-mail (tous mis à jour avec le nouveau mot de passe).
 */
import fs from 'node:fs';
import path from 'node:path';

const TMP_TOKENS = '/tmp/ku-reset-tokens.json';
const TMP_USERS = '/tmp/ku-users.json';

function normalizeEmail(e){ return String(e||'').trim().toLowerCase(); }
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function readTokens(){
  try { if (fs.existsSync(TMP_TOKENS)) return JSON.parse(fs.readFileSync(TMP_TOKENS,'utf8')); } catch {}
  if (globalThis.__kuResetTokens) return globalThis.__kuResetTokens;
  return [];
}
function writeTokens(list){
  globalThis.__kuResetTokens=list;
  try{ fs.writeFileSync(TMP_TOKENS, JSON.stringify(list,null,2),'utf8'); } catch {}
}
function readUsers(){
  try{ if (fs.existsSync(TMP_USERS)) return JSON.parse(fs.readFileSync(TMP_USERS,'utf8')); } catch {}
  if (globalThis.__kuUsersDb) return globalThis.__kuUsersDb;
  try{
    for(const f of [path.join(process.cwd(),'public','users.json'), path.join(process.cwd(),'data','users.json')]){
      if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8'));
    }
  }catch{}
  return { version: 2, inviteCode: 'KU-FIRST-ACCESS', users: [] };
}
function writeUsers(db){
  globalThis.__kuUsersDb=db;
  try{ fs.writeFileSync(TMP_USERS, JSON.stringify(db,null,2),'utf8'); } catch {}
  try{
    const pub=path.join(process.cwd(),'public','users.json');
    fs.mkdirSync(path.dirname(pub),{recursive:true});
    fs.writeFileSync(pub, JSON.stringify(db,null,2),'utf8');
  }catch{}
}

async function deriveKey(password, saltHex){
  const enc = new TextEncoder();
  const toHex=(buf)=> [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const fromHex=(hex)=>{ const out=new Uint8Array(hex.length/2); for(let i=0;i<out.length;i++) out[i]=parseInt(hex.slice(i*2,i*2+2),16); return out.buffer; };
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt: fromHex(saltHex), iterations:120000, hash:'SHA-256' }, keyMaterial, 256);
  return toHex(bits);
}
function randomHex(bytes=16){
  const a=new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export default async function handler(req,res){
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
    const token = String(body.token||'').trim().toUpperCase();
    const newPassword = String(body.newPassword||'');
    if(!email || !isValidEmail(email)) { res.status(400).json({error:'E-mail invalide.'}); return; }
    if(!token) { res.status(400).json({error:'Code requis.'}); return; }
    if(newPassword.length<6){ res.status(400).json({error:'6 caractères minimum.'}); return; }
    let list = readTokens();
    const idx=list.findIndex(e=> e.email===email && String(e.token).toUpperCase()===token);
    if(idx<0){ res.status(400).json({error:'Code invalide ou expiré.'}); return; }
    const entry=list[idx];
    if(entry.expiresAt < Date.now()){ list.splice(idx,1); writeTokens(list); res.status(400).json({error:'Code expiré (15 min). Redemandez un code.'}); return; }
    const db = readUsers();
    const matchingIdxs = db.users.map((u,i)=> (u.email||'').toLowerCase()===email ? i : -1).filter(i=>i>=0);
    if(matchingIdxs.length===0){ res.status(404).json({error:'Compte introuvable.'}); return; }
    const salt = randomHex(16);
    const passwordHash = await deriveKey(newPassword, salt);
    for (const uIdx of matchingIdxs) {
      const s = matchingIdxs.length===1 ? salt : randomHex(16);
      const h = matchingIdxs.length===1 ? passwordHash : await deriveKey(newPassword, s);
      db.users[uIdx] = { ...db.users[uIdx], salt: s, passwordHash: h, updatedAt: new Date().toISOString() };
    }
    writeUsers(db);
    list.splice(idx,1);
    writeTokens(list);
    res.status(200).json({ok:true, message: matchingIdxs.length>1 ? `Mot de passe réinitialisé pour ${matchingIdxs.length} comptes.` : 'Mot de passe réinitialisé.'});
  }catch(e){ res.status(500).json({error:String(e?.message||e)}); }
}
