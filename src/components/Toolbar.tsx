
import { Focus, GitMerge, Link2, Plus, Sparkles, Upload, ZoomIn, ZoomOut, Maximize2, FileJson, FileText, Eraser, Undo2 } from 'lucide-react';
import type { RelationType, RelationTypeDef } from '../lib/types';
import { getAllRelationTypes, getRelationMeta } from '../lib/types';

interface Props {
  onZoomIn: () => void; onZoomOut: () => void; onResetView: () => void; onAddNode: () => void;
  onToggleConnect: () => void; connectMode: boolean; connectType: RelationType; onConnectTypeChange: (t: RelationType) => void;
  customRelationTypes?: RelationTypeDef[]; relationColors?: Partial<Record<string, string>>;
  relationOverrides?: Partial<Record<string, { label?: string; color?: string; style?: string; dashed?: boolean }>>;
  onToggleAI: () => void; aiOpen: boolean; onExportJSON: () => void; onExportMD: () => void; onImport: () => void; onMergeImport?: () => void;
  onUndo?: () => void; onClear?: () => void; onExportWorkspaces?: () => void;
  stats: { nodes: number; edges: number; maxDepth: number };
}

function ToolBtn({ onClick, active, title, children, danger }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={`p-2 rounded-lg transition-all ${active ? 'bg-violet-500/25 text-violet-300 ring-1 ring-violet-500/40' : danger ? 'text-rose-400/70 hover:bg-rose-500/10' : 'text-white/50 hover:text-white/90 hover:bg-white/8'}`}>
      {children}
    </button>
  );
}

export function Toolbar(p: Props) {
  const types = getAllRelationTypes(p.customRelationTypes, p.relationOverrides as never, p.relationColors);
  return (
    <div className="flex items-center gap-1 p-1.5 rounded-2xl border border-white/10 bg-[#12121a]/95 backdrop-blur-xl shadow-2xl max-w-[96vw] overflow-x-auto">
      <ToolBtn onClick={p.onAddNode} title="Nouveau (N)"><Plus size={16} /></ToolBtn>
      <ToolBtn onClick={p.onToggleConnect} active={p.connectMode} title="Connecter (C)"><Link2 size={16} /></ToolBtn>
      {p.connectMode && (
        <select value={p.connectType} onChange={(e) => p.onConnectTypeChange(e.target.value as RelationType)}
          className="ml-0.5 max-w-[120px] rounded-lg bg-violet-500/15 border border-violet-500/30 px-2 py-1.5 text-[10px] text-violet-200 outline-none">
          {types.map((t) => <option key={t.id} value={t.id} className="bg-[#12121a]">{getRelationMeta(t.id, p.relationColors, p.customRelationTypes).label}</option>)}
        </select>
      )}
      <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
      {p.onUndo && <ToolBtn onClick={p.onUndo} title="Annuler"><Undo2 size={16} /></ToolBtn>}
      <ToolBtn onClick={p.onZoomIn} title="Zoom +"><ZoomIn size={16} /></ToolBtn>
      <ToolBtn onClick={p.onZoomOut} title="Zoom -"><ZoomOut size={16} /></ToolBtn>
      <ToolBtn onClick={p.onResetView} title="Vue d'ensemble"><Maximize2 size={16} /></ToolBtn>
      <ToolBtn onClick={p.onResetView} title="Centrer"><Focus size={16} /></ToolBtn>
      <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
      <ToolBtn onClick={p.onToggleAI} active={p.aiOpen} title="IA"><Sparkles size={16} /></ToolBtn>
      <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
      <ToolBtn onClick={p.onExportJSON} title="Exporter JSON"><FileJson size={15} /></ToolBtn>
      {p.onExportWorkspaces && <ToolBtn onClick={p.onExportWorkspaces} title="Exporter espaces"><FileJson size={15} /></ToolBtn>}
      <ToolBtn onClick={p.onExportMD} title="Markdown"><FileText size={15} /></ToolBtn>
      <ToolBtn onClick={p.onImport} title="Importer (remplace)"><Upload size={15} /></ToolBtn>
      {p.onMergeImport && <ToolBtn onClick={p.onMergeImport} title="Fusionner 2 JSON en 1 (sélection multiple)"><GitMerge size={15} /></ToolBtn>}
      {p.onClear && <ToolBtn onClick={p.onClear} title="Effacer" danger><Eraser size={15} /></ToolBtn>}
      <div className="px-2.5 text-[10px] text-white/30 font-mono whitespace-nowrap">{p.stats.nodes} nœuds · {p.stats.edges} liens</div>
    </div>
  );
}
