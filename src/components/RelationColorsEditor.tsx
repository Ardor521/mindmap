
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { EdgeStyle, RelationType, RelationTypeDef } from '../lib/types';
import { getAllRelationTypes, getRelationMeta, slugifyRelationId } from '../lib/types';

const STYLE_OPTS: { id: EdgeStyle; label: string }[] = [
  { id: 'solid', label: 'Plein' },
  { id: 'dashed', label: 'Pointillé' },
  { id: 'dotted', label: 'Tirets fins' },
];

export function RelationColorsEditor({
  relationColors,
  customRelationTypes = [],
  relationOverrides,
  onChange,
  onAddType,
  onRemoveType,
  onPatchType,
}: {
  relationColors: Partial<Record<string, string>>;
  customRelationTypes?: RelationTypeDef[];
  relationOverrides?: Partial<Record<string, { label?: string; color?: string; style?: EdgeStyle; dashed?: boolean; fontSize?: number }>>;
  onChange: (type: RelationType, color: string) => void;
  onReset?: (type: RelationType) => void;
  onAddType?: (def: RelationTypeDef) => void;
  onRemoveType?: (id: string) => void;
  onPatchType?: (id: string, patch: { label?: string; color?: string; style?: EdgeStyle; dashed?: boolean; fontSize?: number }) => void;
  compact?: boolean;
}) {
  const types = getAllRelationTypes(customRelationTypes, relationOverrides, relationColors);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#a78bfa');
  const [style, setStyle] = useState<EdgeStyle>('solid');
  const [fontSize, setFontSize] = useState(12);
  const selectedIds = useMemo(() => types.filter((t) => selected[t.id]).map((t) => t.id), [types, selected]);

  const submitCreate = () => {
    const name = label.trim();
    if (!name || !onAddType) return;
    let id = slugifyRelationId(name);
    if (types.some((t) => t.id === id)) id = `${id}_${Date.now().toString(36).slice(-4)}`;
    onAddType({ id, label: name, color, style, dashed: style !== 'solid', fontSize, custom: true });
    setLabel(''); setColor('#a78bfa'); setStyle('solid'); setFontSize(12); setCreating(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-white/35">Plein & pointillé : hiérarchie + normalisation. Tirets fins : exclus (pas de normalisation).</p>
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_40px_88px] gap-1 px-2 py-1.5 bg-white/5 text-[9px] uppercase tracking-wider text-white/35 font-semibold">
          <span>
            <input type="checkbox" className="accent-violet-400"
              checked={types.length > 0 && types.every((t) => selected[t.id])}
              onChange={(e) => {
                const on = e.target.checked;
                const n: Record<string, boolean> = {};
                types.forEach((t) => { n[t.id] = on; });
                setSelected(n);
              }} />
          </span>
          <span>Nom</span><span>Coul.</span><span>Forme</span>
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
          {types.map((t) => {
            const meta = getRelationMeta(t.id, relationColors, customRelationTypes, relationOverrides);
            const st = meta.style || (meta.dashed ? 'dashed' : 'solid');
            return (
              <div key={t.id} className={`grid grid-cols-[28px_1fr_40px_88px] gap-1 items-center px-2 py-1.5 ${selected[t.id] ? 'bg-violet-500/10' : 'hover:bg-white/3'}`}>
                <input type="checkbox" className="accent-violet-400" checked={!!selected[t.id]} onChange={() => setSelected((s) => ({ ...s, [t.id]: !s[t.id] }))} />
                <input value={meta.label} onChange={(e) => onPatchType?.(t.id, { label: e.target.value })}
                  className="w-full bg-transparent text-xs text-white/85 outline-none border-b border-transparent focus:border-violet-500/40 min-w-0" />
                <label className="relative w-7 h-7 rounded-md overflow-hidden border border-white/15 cursor-pointer justify-self-center">
                  <input type="color" value={meta.color} onChange={(e) => { onChange(t.id, e.target.value); onPatchType?.(t.id, { color: e.target.value }); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <span className="block w-full h-full" style={{ background: meta.color }} />
                </label>
                <select value={st} onChange={(e) => { const s = e.target.value as EdgeStyle; onPatchType?.(t.id, { style: s, dashed: s !== 'solid' }); }}
                  className="w-full rounded-md bg-[#0c0c12] border border-white/10 px-1 py-1 text-[10px] text-white/70 outline-none">
                  {STYLE_OPTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
      {selectedIds.length > 0 && onRemoveType && (
        <button type="button" onClick={() => {
          const customs = selectedIds.filter((id) => types.find((t) => t.id === id)?.custom);
          if (!customs.length) { alert('Seuls les types perso peuvent être supprimés.'); return; }
          if (confirm(`Supprimer ${customs.length} type(s) ?`)) { customs.forEach((id) => onRemoveType(id)); setSelected({}); }
        }} className="text-xs text-rose-300/80 flex items-center gap-1"><Trash2 size={12} /> Supprimer types perso cochés</button>
      )}
      {onAddType && (
        <div className="pt-1 border-t border-white/8">
          {!creating ? (
            <button type="button" onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-violet-200/90 bg-violet-500/10 border border-violet-500/25">
              <Plus size={13} /> Nouveau type de lien
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-white/4 border border-white/10 space-y-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom" className="w-full rounded-lg bg-[#0c0c12] border border-white/10 px-2.5 py-1.5 text-xs text-white/85 outline-none" />
              <div className="flex gap-2 items-center">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded border border-white/15 cursor-pointer p-0.5" />
                {STYLE_OPTS.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={`flex-1 py-1.5 rounded-lg text-[10px] border ${style === s.id ? 'bg-violet-500/20 border-violet-400/40 text-violet-100' : 'bg-white/4 border-white/8 text-white/45'}`}>{s.label}</button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[10px] text-white/45">Police
                <input type="range" min={8} max={22} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1 accent-violet-400" />
                <span className="font-mono w-6">{fontSize}</span>
              </label>
              <div className="flex gap-1.5">
                <button type="button" onClick={submitCreate} disabled={!label.trim()} className="flex-1 py-1.5 rounded-lg text-xs bg-violet-500/25 border border-violet-500/40 text-violet-100 disabled:opacity-40">Créer</button>
                <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/50">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
