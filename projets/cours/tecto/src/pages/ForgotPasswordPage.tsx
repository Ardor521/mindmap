import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Mail, Sparkles, Check } from 'lucide-react';
import { requestPasswordReset, resetPassword } from '../lib/auth';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [devToken, setDevToken] = useState('');

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (!res.ok) setErr(res.error || 'Erreur');
    else {
      setMsg(res.message || 'E-mail envoyé (simulation).');
      if (res.token) setDevToken(res.token);
      setStep(2);
    }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    const res = await resetPassword(email, token, newPassword);
    setBusy(false);
    if (!res.ok) setErr(res.error || 'Erreur');
    else {
      setMsg('Mot de passe réinitialisé. Tu peux te connecter.');
      setToken(''); setNewPassword('');
    }
  };

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
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-4">
            <ArrowLeft size={12} /> Retour connexion
          </Link>
          <h1 className="text-xl font-semibold text-white/95 flex items-center gap-2">
            <KeyRound size={16} className="text-violet-300" /> Mot de passe oublié
          </h1>
          <p className="text-sm text-white/40 mt-1 mb-5">
            {step === 1 ? 'Entre ton e-mail — on t’envoie un code de réinitialisation.' : 'Entre le code reçu et ton nouveau mot de passe.'}
          </p>

          {(err || msg) && (
            <div className={`mb-4 rounded-xl border px-3 py-2 text-xs leading-relaxed ${err ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
              {err || msg}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={onRequest} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold flex items-center gap-1">
                  <Mail size={10} /> E-mail du compte
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="toi@exemple.com"
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-violet-500/50"
                />
                <p className="mt-1.5 text-[11px] text-white/30">Astuce : ajoute ton e-mail dans ton profil pour pouvoir réinitialiser. En local (démo), le code s’affiche ci-dessous après envoi.</p>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Envoyer le code
              </button>
            </form>
          ) : (
            <form onSubmit={onReset} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Code de réinitialisation</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="KU-RESET-XXXXXX"
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none font-mono tracking-wide uppercase"
                />
                {devToken && (
                  <p className="mt-1.5 text-[11px] text-amber-200/70 flex items-center gap-1">
                    <Check size={11} /> Code (démo locale) : <code className="text-white font-mono">{devToken}</code>
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Nouveau mot de passe (6+ car.)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-violet-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />} Réinitialiser
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setErr(''); setMsg(''); }}
                className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/8"
              >
                Renvoyer un code
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-white/30">
            Besoin d’un compte ? <Link to="/register" className="text-violet-300 hover:text-violet-200">Créer un compte</Link>
          </p>
          <p className="mt-2 text-center text-[11px] text-white/20">
            Production : branche <code className="text-white/35">fetch('/api/reset-password')</code> pour envoyer un vrai e-mail via Resend/SendGrid. Le flux local est déjà compatible.
          </p>
        </div>
      </div>
    </div>
  );
}
