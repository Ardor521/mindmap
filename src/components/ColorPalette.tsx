
import { Check, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NODE_COLORS } from '../lib/types';

interface Props {
  value?: string;
  customColors: string[];
  onPick: (color: string) => void;
  onAddCustomColor: (color: string) => void;
  onRemoveCustomColor: (color: string) => void;
  size?: 'sm' | 'md';
}

export function ColorPalette({ value, customColors, onPick, onAddCustomColor, onRemoveCustomColor, size = 'sm' }: Props) {
  const [draft, setDraft] = useState(value || '#a78bfa');
  const [open, setOpen] = useState(false);
  const base = NODE_COLORS;
  const customs = useMemo(() => {
    const seen = new Set(base.map((c) => c.toLowerCase()));
    return customColors.filter((c) => !seen.has(c.toLowerCase()));
  }, [customColors]);
  const dim = size === 'sm' ? 24 : 28;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {base.map((c) => (
          <button key={c} type="button" onClick={() => onPick(c)} className="rounded-full transition-transform hover:scale-110"
            style={{ width: dim, height: dim, background: c, boxShadow: value?.toLowerCase() === c.toLowerCase() ? `0 0 0 2px #12121a, 0 0 0 4px ${c}` : undefined }} title={c} />
        ))}
        {customs.map((c) => (
          <div key={c} className="relative group/swatch">
            <button type="button" onClick={() => onPick(c)} className="rounded-full transition-transform hover:scale-110"
              style={{ width: dim, height: dim, background: c, boxShadow: value?.toLowerCase() === c.toLowerCase() ? `0 0 0 2px #12121a, 0 0 0 4px ${c}` : undefined }} title={c} />
            <button type="button" title="Retirer" onClick={(e) => { e.stopPropagation(); onRemoveCustomColor(c); }}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#1a1a24] border border-white/20 text-white/70 hover:text-rose-300 flex items-center justify-center opacity-0 group-hover/swatch:opacity-100">
              <X size={8} strokeWidth={3} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => { setDraft(value || '#a78bfa'); setOpen((o) => !o); }}
          className="rounded-full border border-dashed border-white/30 flex items-center justify-center text-white/50 hover:text-white/80"
          style={{ width: dim, height: dim }} title="Pipette">
          <Plus size={12} />
        </button>
      </div>
      {open && (
        <div className="p-3 rounded-xl border border-white/10 bg-[#0c0c12] space-y-2.5">
          <div className="flex items-center gap-3">
            <input type="color" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer p-0.5" />
            <input value={draft} onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setDraft(e.target.value); }}
              className="flex-1 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono text-white/80 outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { if (!/^#[0-9a-fA-F]{6}$/i.test(draft)) return; onAddCustomColor(draft); onPick(draft); setOpen(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-500/20 border border-violet-500/35 text-xs text-violet-200">
              <Check size={13} /> Valider et ajouter
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
