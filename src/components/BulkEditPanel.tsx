
import type { KnowledgeNode } from '../lib/types';
import { ICON_OPTIONS } from './NodeCard';
import { ColorPalette } from './ColorPalette';

export function BulkEditPanel({
  nodes, allNodes, customColors, onClose, onApply, onApplyScalePercent, onScaleFactor, onRequestDelete,
  onAddCustomColor, onRemoveCustomColor, onNavigate,
}: {
  nodes: KnowledgeNode[]; allNodes: KnowledgeNode[]; customColors: string[];
  onClose: () => void; onApply: (ids: string[], patch: Partial<KnowledgeNode>) => void;
  onApplyScalePercent: (ids: string[], pct: number) => void;
  /** Multiply each selected concept scale individually (e.g. 1.1 / 0.9) */
  onScaleFactor?: (ids: string[], factor: number) => void;
  onRequestDelete: (ids: string[]) => void;
  onAddCustomColor: (c: string) => void; onRemoveCustomColor: (c: string) => void;
  onNavigate: (id: string) => void;
}) {
  const ids = nodes.map((n) => n.id);
  if (nodes.length < 2) return null;
  const apply = (patch: Partial<KnowledgeNode>) => onApply(ids, patch);
  const anyPrimary = nodes.some((n) => n.isPrimary);

  return (
    <aside className="absolute top-16 right-4 bottom-4 w-[360px] z-[80] flex flex-col rounded-2xl border border-violet-500/25 bg-[#12121a]/97 backdrop-blur-2xl shadow-2xl overflow-hidden">
      <div className="flex items-start gap-3 p-4 border-b border-white/8">
        <div className="flex-1">
          <div className="text-base font-semibold text-white/95">{nodes.length} concepts sélectionnés</div>
          <div className="text-[11px] text-white/35">Édition groupée</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {nodes.map((n) => (
            <button key={n.id} type="button" onClick={() => onNavigate(n.id)} className="px-2 py-1 rounded-lg text-[11px] border border-white/10 bg-white/5 text-white/70 truncate max-w-[140px]" style={{ borderColor: `${n.color}55` }}>
              {n.title || 'Sans titre'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Couleur</label>
          <div className="mt-1.5"><ColorPalette customColors={customColors} onPick={(c) => apply({ color: c })} onAddCustomColor={onAddCustomColor} onRemoveCustomColor={onRemoveCustomColor} size="md" /></div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Icône</label>
          <div className="mt-1.5 flex flex-wrap gap-1 max-h-28 overflow-y-auto">
            {ICON_OPTIONS.map((icon) => (
              <button key={icon} type="button" onClick={() => apply({ icon })} className="px-2 py-1 rounded-md text-[10px] border bg-white/4 border-white/8 text-white/40 hover:text-white/70">{icon}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Rôle</label>
          <div className="mt-1.5 flex gap-1.5">
            <button type="button" onClick={() => apply({ isPrimary: true })} className={`flex-1 py-2 rounded-xl text-xs border ${anyPrimary ? 'bg-amber-500/20 border-amber-400/40 text-amber-100' : 'bg-white/5 border-white/10 text-white/55'}`}>★ Principaux</button>
            <button type="button" onClick={() => apply({ isPrimary: false })} className="flex-1 py-2 rounded-xl text-xs border bg-white/5 border-white/10 text-white/55">Standards</button>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
            Taille individuelle (±10 %)
          </label>
          <p className="text-[10px] text-white/30 mt-1 mb-1.5">
            Chaque concept est multiplié séparément (pas d’uniformisation).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onScaleFactor?.(ids, 0.9)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-400/35 text-amber-100 hover:bg-amber-500/25"
            >
              −10%
            </button>
            <button
              type="button"
              onClick={() => onScaleFactor?.(ids, 1.1)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-400/35 text-amber-100 hover:bg-amber-500/25"
            >
              +10%
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
            Échelle relative au parent (tous pareil)
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[100, 80, 60, 50, 40, 30, 20, 10].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onApplyScalePercent(ids, pct)}
                className="min-w-[2.4rem] px-1.5 py-1.5 rounded-lg text-[11px] border bg-white/4 border-white/8 text-white/50 hover:bg-white/8"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-white/8">
        <button onClick={() => onRequestDelete(ids)} className="w-full py-2 rounded-xl text-xs text-rose-400/70 hover:bg-rose-500/10">Supprimer la sélection</button>
      </div>
    </aside>
  );
}
