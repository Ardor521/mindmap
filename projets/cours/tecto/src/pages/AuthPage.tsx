import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function usePostAuthPath() {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') ? from : '/app';
}

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const after = usePostAuthPath();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={after} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Erreur');
    else nav(after);
  };

  return (
    <AuthShell title="Connexion" subtitle="Pseudo, e-mail ou mot de passe">
      {loading ? (
        <p className="text-sm text-white/40 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Chargement des comptes…
        </p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-3">
            <Field
              label="Pseudo ou e-mail"
              type="text"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              placeholder="pseudo ou toi@exemple.com"
            />
            <Field
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <p className="text-xs text-rose-400 leading-relaxed">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Se connecter
            </button>
          </form>
          <div className="mt-3 flex items-center justify-between text-xs">
            <Link to="/forgot-password" className="text-violet-300 hover:text-violet-200">
              Mot de passe oublié ?
            </Link>
            <Link to="/register" className="text-white/40 hover:text-white/70">
              Créer un compte
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register, loading } = useAuth();
  const nav = useNavigate();
  const after = usePostAuthPath();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={after} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await register({ username, email: email.trim() || undefined, password, inviteCode });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Erreur');
    else nav(after.includes('guide') ? after : '/app?guide=1');
  };

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Pseudo + mot de passe + code d’invitation (e-mail optionnel)"
    >
      {loading ? (
        <p className="text-sm text-white/40 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-3">
            <Field
              label="Pseudo"
              type="text"
              value={username}
              onChange={setUsername}
              autoComplete="username"
            />
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold flex items-center gap-1">
                <Mail size={10} /> E-mail <span className="text-white/25 font-normal">(optionnel)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="toi@exemple.com — optionnel, utile pour mot de passe oublié"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-violet-500/50"
              />
              <p className="mt-1.5 text-[10px] text-white/30 leading-relaxed">
                Optionnel. Si tu le renseignes, tu pourras réinitialiser ton mot de passe. Non affiché publiquement.
              </p>
            </div>
            <Field
              label="Mot de passe (6+ car.)"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold flex items-center gap-1">
                <KeyRound size={10} /> Code d’invitation
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoComplete="one-time-code"
                placeholder="KU-XXXX-XXXX"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-violet-500/50 font-mono tracking-wide uppercase"
              />
              <p className="mt-1.5 text-[10px] text-white/30 leading-relaxed">
                Premier code : <code className="text-white/50">KU-FIRST-ACCESS</code> — ensuite le
                code change à chaque compte (voir users.json exporté).
              </p>
            </div>
            {error && <p className="text-xs text-rose-400 leading-relaxed">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Créer mon compte
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-white/40">
            Déjà inscrit ?{' '}
            <Link to="/login" className="text-violet-300 hover:text-violet-200">
              Se connecter
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-violet-500/50"
      />
    </div>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(139,92,246,0.2),transparent)]" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        <div className="flex items-center gap-2 mb-8 text-white/80">
          <div className="w-8 h-8 rounded-lg bg-violet-500/25 border border-violet-400/30 flex items-center justify-center">
            <Sparkles size={14} className="text-violet-300" />
          </div>
          <span className="text-sm font-semibold">Knowledge Universe</span>
        </div>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a]/95 backdrop-blur-xl p-6 shadow-2xl">
          <h1 className="text-xl font-semibold text-white/95">{title}</h1>
          <p className="text-sm text-white/40 mt-1 mb-5">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
