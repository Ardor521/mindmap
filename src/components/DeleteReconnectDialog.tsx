
import { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Unlink, X } from 'lucide-react';
import type { GraphData, RelationType } from '../lib/types';
import { getRelationMeta } from '../lib/types';
import { getPeerNeighbors, suggestPeerBridges } from '../lib/deleteGraph';

export type ReconnectMode = 'bridge' | 'none' | 'custom';
export interface DeletePlan {
  ids: string[];
  mode: ReconnectMode;
  bridges: { source: string; target: string; type: RelationType }[];
}

export function DeleteReconnectDialog({ nodeIds, graph, onConfirm, onCancel }: {
  nodeIds: string[]; graph: GraphData; onConfirm: (p: DeletePlan) => void; onCancel: () => void;
}) {
  const idSet = useMemo(() => new Set(nodeIds), [nodeIds]);
  const nodes = useMemo(() => graph.nodes.filter((n) => idSet.has(n.id)), [graph.nodes, idSet]);
  const peerNeighbors = useMemo(() => getPeerNeighbors(nodeIds, graph), [nodeIds, graph]);
  const suggestedBridges = useMemo(() => suggestPeerBridges(nodeIds, graph), [nodeIds, graph]);
  const [mode, setMode] = useState<ReconnectMode>(suggestedBridges.length ? 'bridge' : 'none');
  const [customPairs, setCustomPairs] = useState<{ source: string; target: string; type: RelationType }[]>([]);
  const [pickA, setPickA] = useState('');
  const [pickB, setPickB] = useState('');
  const externalNodes = useMemo(() => {
    const ids = new Set<string>();
    peerNeighbors.forEach((list) => list.forEach((n) => ids.add(n.node.id)));
    return [...ids].map((id) => graph.nodes.find((n) => n.id === id)!).filter(Boolean)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [peerNeighbors, graph.nodes]);

  const title = nodes.length === 1 ? `Supprimer « ${nodes[0].title || 'Sans titre'} » ?` : `Supprimer ${nodes.length} concepts ?`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14141e] shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-4 border-b border-white/8">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-rose-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white/95">{title}</h2>
            <p className="text-[11px] text-white/40 mt-1">Hiérarchie réparée auto. Ponts pairs optionnels.</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-white/30 hover:bg-white/8"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {([
            ['bridge', 'Relier les pairs', Link2],
            ['none', 'Ne pas créer de ponts', Unlink],
            ['custom', 'Choisir les ponts', Link2],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setMode(id)}
              className={`w-full text-left p-3 rounded-xl border ${mode === id ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/8 bg-white/4'}`}>
              <div className="flex items-center gap-2 text-sm text-white/90 font-medium"><Icon size={15} /> {label}</div>
            </button>
          ))}
          {mode === 'custom' && externalNodes.length >= 2 && (
            <div className="p-3 rounded-xl bg-white/4 border border-white/8 space-y-2">
              <div className="flex gap-2">
                <select value={pickA} onChange={(e) => setPickA(e.target.value)} className="flex-1 rounded-lg bg-[#0c0c12] border border-white/10 px-2 py-1.5 text-xs text-white/80">
                  <option value="">Source…</option>
                  {externalNodes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Sans titre'}</option>)}
                </select>
                <select value={pickB} onChange={(e) => setPickB(e.target.value)} className="flex-1 rounded-lg bg-[#0c0c12] border border-white/10 px-2 py-1.5 text-xs text-white/80">
                  <option value="">Cible…</option>
                  {externalNodes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Sans titre'}</option>)}
                </select>
              </div>
              <button type="button" disabled={!pickA || !pickB || pickA === pickB}
                onClick={() => { setCustomPairs((p) => [...p, { source: pickA, target: pickB, type: 'related' }]); setPickA(''); setPickB(''); }}
                className="w-full py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-200 disabled:opacity-40">Ajouter</button>
              {customPairs.map((p, i) => (
                <div key={i} className="text-[11px] text-white/60 flex justify-between">
                  <span>{graph.nodes.find((n) => n.id === p.source)?.title} → {graph.nodes.find((n) => n.id === p.target)?.title}</span>
                  <button type="button" onClick={() => setCustomPairs((list) => list.filter((_, j) => j !== i))} className="text-rose-300">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/8 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60">Annuler</button>
          <button type="button" onClick={() => onConfirm({
            ids: nodeIds, mode,
            bridges: mode === 'bridge' ? suggestedBridges : mode === 'custom' ? customPairs : [],
          })} className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/35 text-sm text-rose-200">Supprimer</button>
        </div>
      </div>
    </div>
  );
}
