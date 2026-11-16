
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Brain, Layers, Network, Orbit, Shield, Sparkles, Zap, CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.28),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(6,182,212,0.12),transparent)]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/40 to-cyan-500/30 border border-white/15 flex items-center justify-center">
            <Sparkles size={16} className="text-violet-200" />
          </div>
          <span className="font-semibold tracking-tight">Knowledge Universe</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link to="/pricing" className="text-sm text-white/55 hover:text-white/90 px-3 py-1.5">Tarifs</Link>
          {user ? (
            <Link
              to="/app"
              className="text-sm px-4 py-2 rounded-xl bg-violet-500/25 border border-violet-400/40 text-violet-100 hover:bg-violet-500/35"
            >
              Ouvrir l’app
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-white/60 hover:text-white px-3 py-1.5">Connexion</Link>
              <Link
                to="/register"
                className="text-sm px-4 py-2 rounded-xl bg-white text-[#0a0a0f] font-medium hover:bg-white/90"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-400/30 bg-violet-500/10 text-xs text-violet-200 mb-6">
            <Zap size={12} /> Essai Pro 14 jours · sans carte bancaire
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1]">
            Cartographiez la connaissance
            <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              à toutes les échelles
            </span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-white/50 leading-relaxed">
            Univers 3D zoomable ou mindmap 2D. Hiérarchie intelligente, multi-chemins,
            espaces isolés — un outil pensé pour les esprits structurés.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={user ? '/app' : '/register'}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-medium shadow-lg shadow-violet-500/25"
            >
              {user ? 'Continuer' : 'Commencer gratuitement'} <ArrowRight size={16} />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white/75 hover:bg-white/5"
            >
              Voir les tarifs
            </Link>
          </div>
        </motion.div>

        <div className="mt-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Orbit, title: 'Univers 3D', desc: 'Zoom infini, échelles hiérarchiques, navigation spatiale de la galaxie au détail.' },
            { icon: Network, title: 'Mindmap 2D', desc: 'Carte mentale plane libre — même puissance de liens, disposition classique.' },
            { icon: Layers, title: 'Multi-chemins', desc: 'Illuminez tous les chemins vers les racines. Parents multiples, normalisation auto.' },
            { icon: Brain, title: 'Assistant intégré', desc: 'Suggestions, sous-concepts, parcours d’apprentissage sur votre graphe.' },
            { icon: Shield, title: 'Comptes sécurisés', desc: 'Mot de passe chiffré (PBKDF2), espaces privés par utilisateur, export portable.' },
            { icon: CreditCard, title: 'Prêt pour le paiement', desc: 'Plans Free / Pro / Team, essai 14 jours, branchement Stripe en un clic.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-violet-400/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center mb-3">
                <Icon size={18} className="text-violet-300" />
              </div>
              <h3 className="font-medium text-white/90">{title}</h3>
              <p className="mt-1.5 text-sm text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/8 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Knowledge Universe ·{' '}
        <Link to="/pricing" className="hover:text-white/50">Tarifs</Link>
        {' · '}
        <Link to="/login" className="hover:text-white/50">Connexion</Link>
      </footer>
    </div>
  );
}
