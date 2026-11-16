import { useEffect, useState, useRef } from 'react';
import { Download, X } from 'lucide-react';

export function ExportWorkspacesModal({ open, workspaces, activeId, onClose, onExport }: {
  open: boolean;
  workspaces: { id: string; name: string }[];
  activeId: string;
  onClose: () => void;
  onExport: (ids: string[]) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const prevOpenRef = useRef(false);
  useEffect(() => {
    // Only reset selection when modal *opens*, not on every workspaces mutation while open
    // (previous bug: dep on workspaces caused click to be instantly reverted)
    if (open && !prevOpenRef.current) {
      const init: Record<string, boolean> = {};
      workspaces.forEach((w) => { init[w.id] = w.id === activeId; });
      setChecked(init);
    }
    prevOpenRef.current = open;
  }, [open, workspaces, activeId]);
  if (!open) return null;
  const selected = workspaces.filter((w) => checked[w.id]).map((w) => w.id);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14141e] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-white/8">
          <Download size={18} className="text-violet-300" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-white/95">Exporter des espaces</h2>
            <p className="text-[11px] text-white/40">Fichier portable multi-espaces</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:bg-white/8"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => { const n: Record<string, boolean> = {}; workspaces.forEach((w) => { n[w.id] = true; }); setChecked(n); }} className="flex-1 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">Tout cocher</button>
            <button type="button" onClick={() => { const n: Record<string, boolean> = {}; workspaces.forEach((w) => { n[w.id] = false; }); setChecked(n); }} className="flex-1 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">Rien</button>
          </div>
          {workspaces.map((w) => (
            <label key={w.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-colors ${checked[w.id] ? 'border-violet-500/35 bg-violet-500/10' : 'border-white/8 bg-white/4 hover:bg-white/8'}`}>
              <input type="checkbox" checked={!!checked[w.id]} onChange={() => setChecked((c) => ({ ...c, [w.id]: !c[w.id] }))} className="accent-violet-400 w-4 h-4 shrink-0" />
              <span className="text-sm text-white/85 flex-1 truncate">{w.name}</span>
              {w.id === activeId && <span className="text-[10px] text-violet-300/80 shrink-0">actif</span>}
            </label>
          ))}
          {workspaces.length === 0 && (
            <p className="text-xs text-white/30 text-center py-4">Aucun espace à exporter</p>
          )}
        </div>
        <div className="p-4 border-t border-white/8 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10">Annuler</button>
          <button type="button" disabled={!selected.length} onClick={() => onExport(selected)} className="flex-1 py-2.5 rounded-xl bg-violet-500/25 border border-violet-500/40 text-sm text-violet-100 disabled:opacity-40 hover:bg-violet-500/30">
            Exporter ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
}
