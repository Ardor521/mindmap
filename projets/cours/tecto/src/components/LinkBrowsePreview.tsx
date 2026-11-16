import { ArrowDownToLine, ArrowUpFromLine, CornerDownRight, GitBranch, X } from 'lucide-react';
import type { KnowledgeEdge, KnowledgeNode } from '../lib/types';
import { getRelationMeta } from '../lib/types';

export type BrowseRole = 'parent' | 'child' | 'peer';

export type BrowseLink = {
  edge: KnowledgeEdge;
  target: KnowledgeNode;
  /** angle from current node center, radians */
  angle: number;
  /** Relation hiérarchique relative au concept d'origine */
  role: BrowseRole;
};

interface Props {
  from: KnowledgeNode;
  links: BrowseLink[];
  focusIndex: number;
  onFocusChange: (i: number) => void;
  onConfirm: (targetId: string) => void;
  onCancel: () => void;
  relationColors?: Partial<Record<string, string>>;
  customRelationTypes?: { id: string; label: string; color: string }[];
}

const ROLE_META: Record<
  BrowseRole,
  { label: string; short: string; color: string; bg: string; border: string; Icon: typeof ArrowUpFromLine }
> = {
  parent: {
    label: 'Concept père',
    short: 'Père',
    color: '#fbbf24',
    bg: 'bg-amber-500/20',
    border: 'border-amber-400/45',
    Icon: ArrowUpFromLine,
  },
  child: {
    label: 'Concept fils',
    short: 'Fils',
    color: '#a78bfa',
    bg: 'bg-violet-500/20',
    border: 'border-violet-400/45',
    Icon: ArrowDownToLine,
  },
  peer: {
    label: 'Concept pair',
    short: 'Pair',
    color: '#67e8f9',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-400/35',
    Icon: GitBranch,
  },
};

export function LinkBrowsePreview({
  from,
  links,
  focusIndex,
  onFocusChange,
  onConfirm,
  onCancel,
  relationColors,
  customRelationTypes,
}: Props) {
  if (!links.length) return null;
  const i = ((focusIndex % links.length) + links.length) % links.length;
  const cur = links[i];
  const meta = getRelationMeta(cur.edge.type, relationColors, customRelationTypes as never);
  const label = (cur.edge.label || '').trim() || meta.label;
  const edgeColor = cur.edge.color || meta.color;
  const role = ROLE_META[cur.role] || ROLE_META.peer;
  const RoleIcon = role.Icon;

  const parents = links.filter((l) => l.role === 'parent').length;
  const children = links.filter((l) => l.role === 'child').length;
  const peers = links.filter((l) => l.role === 'peer').length;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[90] w-[min(460px,94vw)] pointer-events-auto">
      <div className="rounded-2xl border border-cyan-500/35 bg-[#0e121a]/96 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-black/50">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/8">
          <CornerDownRight size={14} className="text-cyan-300" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/90 truncate">
              Liens de « {from.title || 'Sans titre'} »
            </div>
            <div className="text-[10px] text-white/35 flex flex-wrap gap-x-2 gap-y-0.5">
              <span>← → tourner · Entrée y aller · Échap</span>
              <span className="text-amber-300/70">{parents} père{parents > 1 ? 's' : ''}</span>
              <span className="text-violet-300/70">{children} fils</span>
              <span className="text-cyan-300/70">{peers} pair{peers > 1 ? 's' : ''}</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-white/40 shrink-0">
            {i + 1}/{links.length}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-white/30 hover:bg-white/8"
          >
            <X size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onConfirm(cur.target.id)}
          className="w-full text-left p-4 hover:bg-white/[0.03] transition-colors"
          style={{ borderLeft: `4px solid ${role.color}` }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-xl shrink-0 overflow-hidden flex items-center justify-center border relative"
              style={{
                background: cur.target.imageUrl
                  ? undefined
                  : `linear-gradient(145deg, ${cur.target.color}40, ${cur.target.color}12)`,
                borderColor: role.color,
                boxShadow: `0 0 0 1px ${role.color}44`,
              }}
            >
              {cur.target.imageUrl ? (
                <img
                  src={cur.target.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: cur.target.color }}
                />
              )}
              <span
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border border-black/40"
                style={{ background: role.color }}
                title={role.label}
              >
                <RoleIcon size={11} className="text-black/80" strokeWidth={2.5} />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${role.bg} ${role.border}`}
                  style={{ color: role.color }}
                >
                  <RoleIcon size={11} />
                  {role.label}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: edgeColor }}
                >
                  lien : {label}
                </span>
              </div>
              <div className="text-base font-semibold text-white/95 truncate">
                {cur.target.title || 'Sans titre'}
              </div>
              {cur.target.description ? (
                <p className="mt-1 text-xs text-white/45 line-clamp-2 leading-relaxed">
                  {cur.target.description}
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/25 italic">Sans description</p>
              )}
              <div className="mt-1.5 text-[10px] font-mono text-white/30">
                échelle{' '}
                {cur.target.scale >= 0.01 && cur.target.scale < 100
                  ? cur.target.scale.toFixed(2)
                  : cur.target.scale.toExponential(1)}
                {cur.role === 'parent' && from.scale > 0 && (
                  <span className="text-amber-300/60">
                    {' '}
                    · ×{(cur.target.scale / from.scale).toFixed(2)} vs ici
                  </span>
                )}
                {cur.role === 'child' && cur.target.scale > 0 && (
                  <span className="text-violet-300/60">
                    {' '}
                    · ×{(from.scale / Math.max(cur.target.scale, 1e-15)).toFixed(2)} plus petit
                  </span>
                )}
              </div>
            </div>
            <kbd className="shrink-0 self-center text-[11px] font-mono text-cyan-100 px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/35">
              ↵
            </kbd>
          </div>
        </button>

        <div className="px-2 pb-2 flex gap-1 overflow-x-auto">
          {links.map((l, idx) => {
            const rm = ROLE_META[l.role] || ROLE_META.peer;
            const active = idx === i;
            const RIcon = rm.Icon;
            return (
              <button
                key={`${l.edge.id}-${l.target.id}`}
                type="button"
                onClick={() => onFocusChange(idx)}
                title={`${rm.label} — ${l.target.title || 'Sans titre'}`}
                className={`shrink-0 max-w-[130px] px-2 py-1.5 rounded-lg text-[10px] truncate border flex items-center gap-1 ${
                  active
                    ? `${rm.bg} ${rm.border} text-white/95`
                    : 'bg-white/[0.03] border-white/8 text-white/45 hover:bg-white/6'
                }`}
                style={active ? { boxShadow: `0 0 0 1px ${rm.color}66` } : undefined}
              >
                <RIcon size={10} style={{ color: rm.color, flexShrink: 0 }} />
                <span className="truncate">{l.target.title || 'Sans titre'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
