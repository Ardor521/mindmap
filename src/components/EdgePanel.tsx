
import { useEffect, useMemo, useState } from 'react';
import { Link2, Trash2, X } from 'lucide-react';
import type { GraphData, KnowledgeEdge, RelationType, RelationTypeDef } from '../lib/types';
import { BUILTIN_RELATION_META, getAllRelationTypes, getRelationMeta, isBuiltinRelation } from '../lib/types';
import { RelationColorsEditor } from './RelationColorsEditor';

const EDGE_STYLES = [
  { id: 'solid' as const, label: 'Plein' },
  { id: 'dashed' as const, label: 'Pointillé' },
  { id: 'dotted' as const, label: 'Tirets fins' },
];

export function EdgePanel({
  edges, graph, onClose, onUpdate, onUpdateMany, onDelete, onNavigate,
  relationColors, customRelationTypes, onSetRelationColor, onResetRelationColor,
  onAddRelationType, onRemoveRelationType, onPatchRelationType, relationOverrides,
  defaultLinkFontSize = 12, onSetDefaultLinkFontSize,
}: {
  edges: KnowledgeEdge[]; graph: GraphData; onClose: () => void;
  onUpdate: (id: string, patch: Partial<KnowledgeEdge>) => void;
  onUpdateMany: (ids: string[], patch: Partial<KnowledgeEdge>) => void;
  onDelete: (ids: string[]) => void; onNavigate: (id: string) => void;
  relationColors?: Partial<Record<string, string>>;
  customRelationTypes?: RelationTypeDef[];
  onSetRelationColor?: (type: RelationType, color: string) => void;
  onResetRelationColor?: (type: RelationType) => void;
  onAddRelationType?: (def: RelationTypeDef) => void;
  onRemoveRelationType?: (id: string) => void;
  onPatchRelationType?: (id: string, patch: { label?: string; color?: string; style?: 'solid'|'dashed'|'dotted'; dashed?: boolean; fontSize?: number }) => void;
  relationOverrides?: Partial<Record<string, { label?: string; color?: string; style?: string; dashed?: boolean; fontSize?: number }>>;
  defaultLinkFontSize?: number;
  onSetDefaultLinkFontSize?: (n: number) => void;
}) {
  const multi = edges.length > 1;
  const edge = edges[0];
  const ids = useMemo(() => edges.map((e) => e.id), [edges]);
  const source = edge ? graph.nodes.find((n) => n.id === edge.source) : null;
  const target = edge ? graph.nodes.find((n) => n.id === edge.target) : null;
  const meta = edge
    ? getRelationMeta(edge.type, relationColors, customRelationTypes, relationOverrides as never)
    : getRelationMeta('related', relationColors, customRelationTypes, relationOverrides as never);
  const relationTypes = getAllRelationTypes(customRelationTypes, relationOverrides as never, relationColors);
  const sameType = edges.every((e) => e.type === edge?.type);
  const sameStyle = edges.every((e) => (e.style || 'solid') === (edge?.style || 'solid'));
  const style = edge?.style || meta.style || (meta.dashed ? 'dashed' : 'solid');
  const color = edge?.color || meta.color;
  const [labelDraft, setLabelDraft] = useState(edge?.label ?? '');
  const [showTypes, setShowTypes] = useState(false);
  useEffect(() => { setLabelDraft(multi ? '' : edge?.label ?? ''); }, [edge?.id, edge?.label, multi]);
  if (!edge) return null;
  const apply = (patch: Partial<KnowledgeEdge>) => {
    const next = { ...patch };
    // New child/parent type without explicit style → solid (default hierarchy)
    // Explicit tirets fins are kept (excluded from hierarchy on purpose)
    if (
      (next.type === 'child' || next.type === 'parent') &&
      next.style === undefined &&
      edge.style !== 'dotted'
    ) {
      next.style = 'solid';
    }
    if (multi) onUpdateMany(ids, next);
    else onUpdate(edge.id, next);
  };

  return (
    <aside className="w-[340px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#12121a]/97 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-black/40">
      <div className="flex items-start gap-3 p-4 border-b border-white/8">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0"><Link2 size={18} className="text-cyan-300" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-white/95">{multi ? `${edges.length} liens` : 'Lien'}</div>
          <div className="text-[11px] text-white/35 mt-0.5">{multi ? 'Shift/Ctrl+L multi · édition groupée' : 'Caractéristiques'}</div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:bg-white/8"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!multi && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => source && onNavigate(source.id)} className="p-2.5 rounded-xl bg-white/4 border border-white/8 text-left">
              <div className="text-[10px] uppercase text-white/30">De</div>
              <div className="flex items-center gap-2 mt-1"><span className="w-2 h-2 rounded-full" style={{ background: source?.color }} /><span className="text-sm text-white/85 truncate">{source?.title || 'Sans titre'}</span></div>
            </button>
            <button type="button" onClick={() => target && onNavigate(target.id)} className="p-2.5 rounded-xl bg-white/4 border border-white/8 text-left">
              <div className="text-[10px] uppercase text-white/30">Vers</div>
              <div className="flex items-center gap-2 mt-1"><span className="w-2 h-2 rounded-full" style={{ background: target?.color }} /><span className="text-sm text-white/85 truncate">{target?.title || 'Sans titre'}</span></div>
            </button>
          </div>
        )}
        {multi && (
          <div className="max-h-28 overflow-y-auto space-y-1">
            {edges.map((e) => {
              const a = graph.nodes.find((n) => n.id === e.source);
              const b = graph.nodes.find((n) => n.id === e.target);
              const m = getRelationMeta(e.type, relationColors, customRelationTypes, relationOverrides as never);
              return <div key={e.id} className="text-[11px] text-white/55 px-2 py-1.5 rounded-lg bg-white/4 border border-white/6 truncate"><span style={{ color: m.color }}>{m.label}</span> · {a?.title || '?'} → {b?.title || '?'}</div>;
            })}
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Type{multi && !sameType ? ' (mixte)' : ''}</label>
          <select value={sameType ? edge.type : ''} onChange={(e) => e.target.value && apply({ type: e.target.value as RelationType })}
            className="mt-1.5 w-full rounded-xl bg-[#0c0c12] border border-white/10 px-3 py-2.5 text-sm outline-none" style={{ color: sameType ? color : undefined }}>
            {!sameType && <option value="">Plusieurs types…</option>}
            {relationTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        {!multi && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Label</label>
            <input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => { const v = labelDraft.trim(); if (v !== (edge.label ?? '')) onUpdate(edge.id, { label: v || undefined }); }}
              placeholder="Texte affiché…" className="mt-1.5 w-full rounded-xl bg-white/4 border border-white/8 px-3 py-2 text-sm text-white/80 outline-none" />
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Couleur du type</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => {
              const c = e.target.value;
              if (onSetRelationColor && sameType) { onSetRelationColor(edge.type, c); apply({ color: undefined }); }
              else apply({ color: c });
            }} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer p-0.5" />
            <span className="text-[11px] text-white/45">{sameType ? `Type « ${meta.label} »` : 'Sélection'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Forme{multi && !sameStyle ? ' (mixte)' : ''}</label>
          <div className="mt-1.5 flex gap-1.5">
            {EDGE_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                title={
                  s.id === 'dotted'
                    ? 'Tirets fins : lien visible mais ignoré pour la hiérarchie et les tailles'
                    : s.label
                }
                onClick={() => apply({ style: s.id })}
                className={`flex-1 py-2 rounded-lg text-[11px] border ${
                  sameStyle && style === s.id
                    ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-200'
                    : 'bg-white/4 border-white/8 text-white/45'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Taille police</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="range" min={8} max={24}
              value={!multi && edge.fontSize != null ? edge.fontSize : meta.fontSize ?? defaultLinkFontSize}
              onChange={(e) => apply({ fontSize: Number(e.target.value) })} className="flex-1 accent-cyan-400" />
            <span className="text-[11px] font-mono text-white/45 w-6 text-right">{!multi && edge.fontSize != null ? edge.fontSize : meta.fontSize ?? defaultLinkFontSize}</span>
          </div>
          {onSetDefaultLinkFontSize && (
            <button type="button" onClick={() => onSetDefaultLinkFontSize(!multi && edge.fontSize != null ? edge.fontSize : meta.fontSize ?? defaultLinkFontSize)}
              className="mt-1 text-[10px] text-white/35 hover:text-white/60">Définir comme défaut projet</button>
          )}
        </div>
        {(onAddRelationType || onSetRelationColor) && (
          <div>
            <button type="button" onClick={() => setShowTypes((v) => !v)} className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{showTypes ? '▾' : '▸'} Gérer les types</button>
            {showTypes && (
              <div className="mt-1.5 p-2 rounded-xl bg-white/3 border border-white/8">
                <RelationColorsEditor relationColors={relationColors ?? {}} customRelationTypes={customRelationTypes}
                  relationOverrides={relationOverrides as never} onChange={onSetRelationColor || (() => {})}
                  onReset={onResetRelationColor} onAddType={onAddRelationType} onRemoveType={onRemoveRelationType} onPatchType={onPatchRelationType} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-white/8">
        <button onClick={() => { if (confirm(multi ? `Supprimer ${edges.length} liens ?` : 'Supprimer ce lien ?')) onDelete(ids); }}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs text-rose-400/70 hover:bg-rose-500/10">
          <Trash2 size={13} /> {multi ? `Supprimer ${edges.length} liens` : 'Supprimer le lien'}
        </button>
      </div>
    </aside>
  );
}
