import { BookOpen, Columns3, GitBranch, Network, Orbit, Timer, Waves, X } from 'lucide-react';
import type { MapKind } from '../lib/types';
import {
  MINDMAP_PATTERNS,
  type MindmapPatternId,
} from '../data/mindmapPatterns';

export type NewWorkspaceChoice = {
  kind: MapKind;
  label: string;
  template?: 'empty' | 'feature-guide' | MindmapPatternId;
  patternId?: MindmapPatternId;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (choice: NewWorkspaceChoice) => void;
  /** 'all' | 'empty-only' (2D/3D + patterns 2D) | 'guide-only' */
  mode?: 'all' | 'empty-only' | 'guide-only';
  title?: string;
  subtitle?: string;
}

const PATTERN_ICONS: Record<MindmapPatternId, typeof Timer> = {
  empty: Network,
  timeline: Timer,
  hub: GitBranch,
  columns: Columns3,
  swimlanes: Waves,
  'feature-guide': BookOpen,
};

export function NewWorkspaceModal({
  open,
  onClose,
  onCreate,
  mode = 'all',
  title,
  subtitle,
}: Props) {
  if (!open) return null;

  const showEmpty = mode === 'all' || mode === 'empty-only';
  const showGuide = mode === 'all' || mode === 'guide-only';
  const showPatterns = showEmpty; // patterns 2D when creating empty maps

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/12 bg-[#12121a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#12121a]/95 backdrop-blur">
          <div>
            <h2 className="text-base font-semibold text-white/95">
              {title ||
                (mode === 'empty-only'
                  ? 'Premier concept'
                  : mode === 'guide-only'
                    ? 'Guide des fonctionnalités'
                    : 'Nouvel espace')}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {subtitle ||
                (mode === 'empty-only'
                  ? 'Choisissez 3D, ou un motif 2D (chronologie, hub…)'
                  : mode === 'guide-only'
                    ? 'Mindmap guide 2D / 3D · Concepts & Liens'
                    : 'Univers 3D ou mindmap 2D avec motifs prêts à l’emploi')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/8"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {showEmpty && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-2">
                Type d’espace
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    onCreate({ kind: 'universe', label: 'Univers', template: 'empty' })
                  }
                  className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:border-violet-400/50 hover:bg-violet-500/10 p-4 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Orbit size={22} className="text-violet-300" />
                  </div>
                  <div className="text-sm font-semibold text-white/90">Univers 3D</div>
                  <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
                    Zoom infini, échelles hiérarchiques — même outils que la 2D, sans plafond de
                    réduction de taille.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onCreate({
                      kind: 'mindmap',
                      label: 'Mindmap',
                      template: 'empty',
                      patternId: 'empty',
                    })
                  }
                  className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:border-cyan-400/50 hover:bg-cyan-500/10 p-4 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Network size={22} className="text-cyan-300" />
                  </div>
                  <div className="text-sm font-semibold text-white/90">Mindmap 2D libre</div>
                  <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
                    Vide. Après 3 niveaux la taille ne diminue plus seule. Ou choisissez un motif
                    ci-dessous.
                  </p>
                </button>
              </div>
            </div>
          )}

          {showPatterns && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-2">
                Motifs 2D prêts à l’emploi
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MINDMAP_PATTERNS.filter((p) => p.id !== 'empty' && p.id !== 'feature-guide').map(
                  (p) => {
                    const Icon = PATTERN_ICONS[p.id] || Network;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          onCreate({
                            kind: 'mindmap',
                            label: p.name,
                            template: p.id,
                            patternId: p.id,
                          })
                        }
                        className="group text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-3.5 transition-all"
                        style={{ borderColor: `${p.accent}33` }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{
                              background: `${p.accent}22`,
                              borderColor: `${p.accent}44`,
                            }}
                          >
                            <Icon size={18} style={{ color: p.accent }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white/90">{p.name}</div>
                            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
                              {p.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {showGuide && (
            <div>
              {(showEmpty || showPatterns) && (
                <div className="text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-2">
                  Documentation
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  onCreate({
                    kind: 'mindmap',
                    label: 'Guide des fonctionnalités',
                    template: 'feature-guide',
                    patternId: 'feature-guide',
                  })
                }
                className="w-full group text-left rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] hover:border-amber-400/50 hover:bg-amber-500/12 p-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                    <BookOpen size={22} className="text-amber-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      Guide des fonctionnalités (2D)
                    </div>
                    <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
                      Branches <strong className="text-cyan-300/90">2D</strong> &{' '}
                      <strong className="text-violet-300/90">3D</strong>, puis{' '}
                      <strong className="text-pink-300/80">Concepts</strong> et{' '}
                      <strong className="text-amber-200/80">Liens</strong>.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
