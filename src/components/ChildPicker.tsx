
import { useEffect, useState } from 'react';
import { CornerDownRight, X } from 'lucide-react';
import type { KnowledgeNode } from '../lib/types';

export function ChildPicker({ parent, children, focusIndex, onFocusChange, onPick, onCancel }: {
  parent: KnowledgeNode; children: KnowledgeNode[]; focusIndex: number;
  onFocusChange: (i: number) => void; onPick: (id: string) => void; onCancel: () => void;
}) {
  const [local, setLocal] = useState(focusIndex);
  useEffect(() => setLocal(focusIndex), [focusIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); const n = Math.min(children.length - 1, local + 1); setLocal(n); onFocusChange(n); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); const n = Math.max(0, local - 1); setLocal(n); onFocusChange(n); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (children[local]) onPick(children[local].id); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [children, local, onCancel, onFocusChange, onPick]);
  if (!children.length) return null;
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[90] w-[min(420px,92vw)]">
      <div className="rounded-2xl border border-violet-500/30 bg-[#12121a]/96 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-black/40">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/8">
          <CornerDownRight size={14} className="text-violet-300" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/90 truncate">Liés à « {parent.title || 'Sans titre'} »</div>
            <div className="text-[10px] text-white/35">Tous types de liens · ↑↓ · Entrée · Échap</div>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg text-white/30 hover:bg-white/8"><X size={14} /></button>
        </div>
        <div className="max-h-56 overflow-y-auto p-1.5">
          {children.map((c, i) => (
            <button key={c.id} type="button" onMouseEnter={() => { setLocal(i); onFocusChange(i); }} onClick={() => onPick(c.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left ${i === local ? 'bg-violet-500/20 border border-violet-400/35' : 'border border-transparent hover:bg-white/5'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="flex-1 text-sm text-white/85 truncate">{c.title || 'Sans titre'}</span>
              {i === local && <kbd className="text-[10px] font-mono text-violet-200/80 px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-400/30">↵</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
