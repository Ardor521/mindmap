import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Call-to-action réutilisable pour ouvrir le guide (après connexion → /app?guide=1) */
export function FeatureGuideCTA({
  variant = 'card',
  className = '',
}: {
  variant?: 'card' | 'inline' | 'banner';
  className?: string;
}) {
  if (variant === 'inline') {
    return (
      <Link
        to="/app?guide=1"
        className={`inline-flex items-center gap-1.5 text-amber-200/90 hover:text-amber-100 underline-offset-2 hover:underline ${className}`}
      >
        <BookOpen size={14} />
        Guide 2D / 3D — Concepts & Liens
      </Link>
    );
  }

  if (variant === 'banner') {
    return (
      <Link
        to="/app?guide=1"
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-colors ${className}`}
      >
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-amber-200" />
        </div>
        <div className="min-w-0 text-left">
          <div className="text-sm font-semibold text-amber-50">Guide des fonctionnalités</div>
          <div className="text-[11px] text-white/45 truncate">
            Mindmap 2D · branches 2D & 3D · toutes les options Concepts et Liens
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/app?guide=1"
      className={`block text-left rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] hover:border-amber-400/45 hover:bg-amber-500/12 p-4 transition-all ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
          <BookOpen size={22} className="text-amber-200" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white/90">Guide des fonctionnalités</div>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            Ouvre une mindmap 2D : d’abord <strong className="text-white/55">2D</strong> et{' '}
            <strong className="text-white/55">3D</strong>, puis toutes les possibilités pour les{' '}
            <strong className="text-pink-300/80">Concepts</strong> et les{' '}
            <strong className="text-amber-200/80">Liens</strong>.
          </p>
        </div>
      </div>
    </Link>
  );
}
