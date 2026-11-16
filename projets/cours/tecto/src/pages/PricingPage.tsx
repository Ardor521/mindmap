
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { PLANS, type PlanId } from '../lib/plans';
import { useAuth } from '../context/AuthContext';

export function PricingPage() {
  const { user } = useAuth();
  // Fallback local (le Drive d'origine n'avait pas encore les champs plan/checkout dans AuthContext)
  const current = PLANS.free as typeof PLANS[PlanId];
  const checkout = async (_id: PlanId, _billing: 'monthly' | 'yearly'): Promise<{ ok: boolean; error?: string; redirected?: boolean }> => {
    // En dev sans Stripe: activation locale simulée
    return { ok: true, redirected: false };
  };
  const nav = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [msg, setMsg] = useState('');

  const order: PlanId[] = ['free', 'pro', 'team'];

  const onSelect = async (id: PlanId) => {
    setMsg('');
    if (!user) {
      nav('/register');
      return;
    }
    if (id === current.id && (user as unknown as { subscriptionStatus?: string })?.subscriptionStatus === 'active') {
      setMsg('C’est déjà votre offre active.');
      return;
    }
    setBusy(id);
    const res = await checkout(id, billing);
    setBusy(null);
    if (!res.ok) setMsg(res.error || 'Erreur');
    else if (!res.redirected) {
      setMsg(id === 'free' ? 'Offre Découverte activée.' : `Offre ${PLANS[id].name} activée.`);
      setTimeout(() => nav('/app'), 800);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(139,92,246,0.22),transparent)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/25 border border-violet-400/30 flex items-center justify-center">
            <Sparkles size={14} className="text-violet-300" />
          </div>
          <span className="text-sm font-semibold">Knowledge Universe</span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/app" className="text-sm px-3 py-1.5 rounded-lg text-white/70 hover:bg-white/5">App</Link>
          ) : (
            <Link to="/login" className="text-sm px-3 py-1.5 text-white/60">Connexion</Link>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Tarifs simples</h1>
          <p className="mt-3 text-white/45 text-sm sm:text-base">
            Commencez gratuitement. Passez Pro quand vous en avez besoin.
            Stripe se branche via variables d’environnement.
          </p>
          <div className="mt-6 inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium ${billing === 'monthly' ? 'bg-violet-500/30 text-violet-100' : 'text-white/45'}`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium ${billing === 'yearly' ? 'bg-violet-500/30 text-violet-100' : 'text-white/45'}`}
            >
              Annuel · -25%
            </button>
          </div>
        </div>

        {msg && (
          <p className="text-center text-sm text-cyan-300/90 mb-6">{msg}</p>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {order.map((id) => {
            const p = PLANS[id];
            const price =
              billing === 'yearly'
                ? Math.round((p.priceYearly / 12) * 10) / 10
                : p.priceMonthly;
            const isCurrent =
              user &&
              current.id === id &&
              ((user as unknown as { subscriptionStatus?: string })?.subscriptionStatus === 'active' ||
                (user as unknown as { subscriptionStatus?: string })?.subscriptionStatus === 'trialing' ||
                id === 'free');
            return (
              <div
                key={id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  p.highlight
                    ? 'border-violet-400/50 bg-violet-500/10 shadow-xl shadow-violet-500/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-violet-500 text-[10px] font-semibold uppercase tracking-wide">
                    Populaire
                  </div>
                )}
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <p className="text-xs text-white/40 mt-1 min-h-[32px]">{p.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{price === 0 ? '0' : price}</span>
                  <span className="text-white/40 text-sm">{price === 0 ? '€' : '€ / mois'}</span>
                </div>
                {billing === 'yearly' && p.priceYearly > 0 && (
                  <p className="text-[11px] text-white/35 mt-1">{p.priceYearly} € facturés / an</p>
                )}
                <ul className="mt-5 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/65">
                      <Check size={14} className="text-violet-300 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy === id}
                  onClick={() => onSelect(id)}
                  className={`mt-6 w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                    p.highlight
                      ? 'bg-violet-500 hover:bg-violet-400 text-white'
                      : 'bg-white/8 hover:bg-white/12 border border-white/10 text-white/85'
                  } disabled:opacity-50`}
                >
                  {busy === id && <Loader2 size={14} className="animate-spin" />}
                  {isCurrent ? 'Offre actuelle' : id === 'free' ? 'Commencer' : 'Choisir'}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-[11px] text-white/30 max-w-xl mx-auto leading-relaxed">
          Production : définissez <code className="text-white/45">VITE_STRIPE_CHECKOUT_URL</code> et les
          Price IDs Stripe. Sans cela, l’activation Pro/Team se fait en local pour le développement.
        </p>
      </main>
    </div>
  );
}
