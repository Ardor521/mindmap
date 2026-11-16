import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  FileJson,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Sparkles,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FeatureGuideCTA } from '../components/FeatureGuideCTA';

export function AccountPage() {
  const {
    user,
    loading,
    updateProfile,
    changePassword,
    logout,
    downloadUsersFile,
    importUsersFile,
    getInviteCode,
    listUsernames,
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [showStoredPwd, setShowStoredPwd] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !hydrated) {
      setName(user.name || '');
      setEmail((user as any).email || '');
      setNote(user.shortcutsNote || '');
      setHydrated(true);
    }
  }, [user, hydrated]);

  useEffect(() => {
    if (user) {
      if ((user as any).email !== undefined) setEmail((user as any).email || '');
      if (user.name !== undefined) setName(user.name || '');
      if (user.shortcutsNote !== undefined) setNote(user.shortcutsNote || '');
    }
  }, [user?.name, (user as any)?.email, user?.shortcutsNote]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white/40 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Chargement du compte…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const saveProfile = () => {
    setErr(''); setMsg('');
    const trimmedEmail = email.trim();
    const trimmedName = name.trim() || user.name;
    const patch: { name: string; email?: string; shortcutsNote: string } = { name: trimmedName, shortcutsNote: note };
    const currentEmail = ((user as any).email || '').trim();
    if (trimmedEmail !== currentEmail) patch.email = trimmedEmail;
    const res: any = (updateProfile as any)(patch);
    if (res && res.ok === false) {
      setErr(res.error || 'E-mail invalide.');
      return;
    }
    setMsg('Profil enregistré ✓');
  };

  const onPwd = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    const res = await changePassword(curPwd, newPwd);
    setBusy(false);
    if (!res.ok) setErr(res.error || 'Erreur');
    else {
      setMsg('Mot de passe mis à jour — utilise-le à la prochaine connexion.');
      setCurPwd('');
      setNewPwd('');
    }
  };

  const downloadUsers = () => {
    downloadUsersFile();
    setMsg(
      'users.json téléchargé (comptes + nouveau code). Remplacez public/users.json par ce fichier pour le déployer, ou réimportez-le ici.'
    );
    setErr('');
  };

  const onImportFile = async (file: File) => {
    setErr('');
    setMsg('');
    try {
      const text = await file.text();
      const res = importUsersFile(text);
      if (!res.ok) setErr(res.error || 'Import impossible');
      else setMsg('Fichier users importé. Les comptes listés sont maintenant actifs.');
    } catch {
      setErr('Lecture du fichier impossible.');
    }
  };

  const names = listUsernames();

  // masked current password (not retrievable, only hash stored)
  const maskedPwd = '••••••••••••';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(139,92,246,0.15),transparent)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-3xl mx-auto">
        <Link to="/app" className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft size={16} /> Retour à l’app
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={14} className="text-violet-300" /> Compte
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 pb-16 space-y-4">
        {(msg || err) && (
          <p className={`text-sm px-3 py-2 rounded-xl border ${err ? 'text-rose-300 bg-rose-500/10 border-rose-500/20' : 'text-cyan-300 bg-emerald-500/10 border-emerald-500/20'}`}>{err || msg}</p>
        )}

        <FeatureGuideCTA variant="banner" />

        <section className="rounded-2xl border border-white/10 bg-[#12121a]/90 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-violet-300" />
            <h2 className="text-sm font-semibold">Identité — compte actuellement connecté</h2>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/25 border border-violet-400/30 flex items-center justify-center shrink-0"><User size={16} className="text-violet-300" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/90">{user.name} <span className="text-white/30 font-normal">· {user.username}</span></div>
                <div className="text-[11px] text-white/35 truncate">Connecté depuis le {new Date(user.createdAt).toLocaleDateString('fr-FR')} · Session active ✓</div>
                <div className="text-[11px] text-white/35 truncate flex items-center gap-1.5">
                  <Mail size={10} /> {(user as any).email || <span className="text-amber-200/70">Pas d’e-mail — ajoute-le ci-dessous pour le reset</span>}
                </div>
              </div>
              <span className="ml-auto hidden sm:inline text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0">Connecté</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35">Identifiant (pseudo)</label>
                <div className="mt-1 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-sm text-white/60 font-mono select-all">
                  {user.username}
                </div>
                <p className="text-[10px] text-white/25 mt-1">Utilisé pour se connecter (ou ton e-mail).</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35">Nom affiché</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={user.name}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500/40"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35 flex items-center gap-1">
                <Mail size={10} /> Adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                autoComplete="email"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500/40"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-white/30">
                <strong className="text-white/50">Plusieurs comptes peuvent partager la même adresse.</strong> Pour “Mot de passe oublié”, le code sera envoyé à cette adresse et réinitialisera tous les comptes qui l’utilisent.
                {!email && <span className="text-amber-200/70"> — Ajoute ton e-mail puis Enregistrer pour activer le reset.</span>}
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35">Notes</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
            <button
              type="button"
              onClick={saveProfile}
              className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium"
            >
              Enregistrer le profil
            </button>
          </div>
        </section>

        {/* Mot de passe — affichage clair */}
        <section className="rounded-2xl border border-white/10 bg-[#12121a]/90 p-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={16} className="text-violet-300" />
            <h2 className="text-sm font-semibold">Mot de passe & sécurité</h2>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-white/35 mb-2">Mot de passe actuel</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm text-white/50 tracking-wider select-none">
                {showStoredPwd ? maskedPwd : '••••••••'}
              </div>
              <button
                type="button"
                onClick={() => setShowStoredPwd(v => !v)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
                title={showStoredPwd ? 'Masquer' : 'Afficher (masqué par sécurité)'}
              >
                {showStoredPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
              Par sécurité, le mot de passe n’est jamais affiché en clair (seul son empreinte est stockée). Clique l’œil pour voir le masque, et utilise ci-dessous pour le changer.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35">Mot de passe actuel *</label>
              <input
                type="password"
                value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)}
                placeholder="Actuel"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35">Nouveau mot de passe *</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="6+ caractères"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500/40"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !curPwd || !newPwd}
            onClick={onPwd}
            className="mt-3 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:bg-white/8 disabled:text-white/30 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Changer mon mot de passe
          </button>
          <Link to="/forgot-password" className="mt-3 inline-flex text-xs text-violet-300 hover:text-violet-200 border-b border-violet-500/20 pb-0.5">
            Mot de passe oublié ? → réinitialiser par e-mail
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#12121a]/90 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileJson size={16} className="text-violet-300" />
            <h2 className="text-sm font-semibold">Fichier users (gestion des comptes)</h2>
          </div>
          <p className="text-xs text-white/40 mb-3 leading-relaxed">
            À chaque inscription le code d’invitation est{' '}
            <strong className="text-white/60">régénéré et enregistré automatiquement</strong> via
            l’API <code className="text-white/50">/api/users</code>. Export/import en secours.
          </p>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 mb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-white/35">Code d’invitation actuel</span>
              <button
                type="button"
                onClick={() => setInviteVisible((v) => !v)}
                className="text-[10px] text-violet-300 hover:text-violet-200"
              >
                {inviteVisible ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <div className="font-mono text-sm tracking-wider text-violet-100">
              {inviteVisible ? getInviteCode() : '••••••••••••'}
            </div>
          </div>

          <div className="flex items-start gap-2 mb-3">
            <Users size={14} className="text-white/30 mt-0.5 shrink-0" />
            <div className="text-xs text-white/45">
              <span className="text-white/60">{names.length}</span> compte(s) :{' '}
              {names.length ? names.join(', ') : 'aucun'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadUsers}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/25 border border-violet-500/40 text-sm text-violet-100"
            >
              <Download size={14} /> Exporter users.json
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 border border-white/10 text-sm text-white/80"
            >
              <Upload size={14} /> Importer users.json
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 text-rose-300/90 text-sm hover:bg-rose-500/10"
        >
          <LogOut size={14} /> Se déconnecter
        </button>
      </main>
    </div>
  );
}
