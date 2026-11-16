
import { useMemo } from 'react';
import type { KnowledgeNode } from '../lib/types';
import { CHILD_SCALE_RATIO } from '../lib/layout';

interface Props {
  node: KnowledgeNode;
  allNodes: KnowledgeNode[];
  onSetScale: (scale: number) => void;
}

const PCT_STEPS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

export function ScaleControls({ node, allNodes, onSetScale }: Props) {
  const parent = useMemo(() => (node.parentId ? allNodes.find((n) => n.id === node.parentId) ?? null : null), [node.parentId, allNodes]);
  const children = useMemo(() => allNodes.filter((n) => n.parentId === node.id), [allNodes, node.id]);
  const siblings = useMemo(() => allNodes.filter((n) => n.id !== node.id && n.parentId === node.parentId), [allNodes, node.id, node.parentId]);
  const refScale = parent?.scale ?? 1;
  const currentPct = Math.round((node.scale / Math.max(refScale, 1e-15)) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/45">{parent ? `Réf. parent « ${parent.title || 'Sans titre'} »` : 'Réf. racine (échelle 1)'}</span>
        <span className="text-[11px] font-mono text-violet-300/90">{currentPct}% · {node.scale >= 0.01 && node.scale < 100 ? node.scale.toFixed(2) : node.scale.toExponential(1)}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSetScale(Math.max(1e-6, node.scale * 0.9))}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-400/35 text-amber-100 hover:bg-amber-500/25"
          title="Réduire la taille du concept de 10 % (liens inchangés)"
        >
          −10%
        </button>
        <button
          type="button"
          onClick={() => onSetScale(node.scale * 1.1)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-400/35 text-amber-100 hover:bg-amber-500/25"
          title="Augmenter la taille du concept de 10 % (liens inchangés)"
        >
          +10%
        </button>
      </div>
      <p className="text-[10px] text-white/30">Modifie uniquement la taille du bloc, pas la longueur des liens.</p>
      <div className="flex flex-wrap gap-1">
        {PCT_STEPS.map((pct) => {
          const active = Math.abs(currentPct - pct) <= 3;
          const isDefault = pct === Math.round(CHILD_SCALE_RATIO * 100);
          return (
            <button key={pct} type="button" onClick={() => onSetScale(refScale * (pct / 100))}
              className={`min-w-[2.5rem] px-1.5 py-1.5 rounded-lg text-[11px] font-medium border ${active ? 'bg-violet-500/25 border-violet-400/45 text-violet-100' : 'bg-white/4 border-white/8 text-white/50 hover:bg-white/8'}`}>
              {pct}%{isDefault ? '*' : ''}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        {parent && <button type="button" onClick={() => onSetScale(parent.scale)} className="w-full py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white/65 hover:bg-white/10">Aligner sur le parent (100%)</button>}
        {parent && <button type="button" onClick={() => onSetScale(parent.scale * CHILD_SCALE_RATIO)} className="w-full py-2 rounded-xl text-xs bg-violet-500/12 border border-violet-500/25 text-violet-200/90">Taille enfant standard (60%)</button>}
        {children.length > 0 && (
          <button type="button" onClick={() => { const avg = children.reduce((s, c) => s + c.scale, 0) / children.length; onSetScale(avg / CHILD_SCALE_RATIO); }}
            className="w-full py-2 rounded-xl text-xs bg-indigo-500/12 border border-indigo-500/25 text-indigo-200/90">Caler comme parent de ses enfants</button>
        )}
        {siblings.length > 0 && (
          <button type="button" onClick={() => { const avg = siblings.reduce((s, c) => s + c.scale, 0) / siblings.length; onSetScale(avg); }}
            className="w-full py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white/65">Aligner sur les frères / sœurs</button>
        )}
      </div>
    </div>
  );
}
