import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, SwatchBook } from 'lucide-react';
import type { KnowledgeNode } from '../lib/types';

function normColor(c: string): string {
  return (c || '#64748b').trim().toLowerCase();
}

export function ConceptColorLegend({
  nodes,
  groupLabels = {},
  onRenameGroup,
  width = 200,
  height = 200,
  onResize,
}: {
  nodes: KnowledgeNode[];
  /** color (lower) → nom du groupe */
  groupLabels?: Record<string, string>;
  onRenameGroup?: (color: string, label: string) => void;
  width?: number;
  height?: number;
  onResize?: (w: number, h: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const colors = useMemo(() => {
    const map = new Map<
      string,
      { color: string; key: string; titles: string[]; count: number }
    >();
    for (const n of nodes) {
      const segs = (n as unknown as { colorSegments?: string[] }).colorSegments;
      const allColors: string[] = segs && segs.length ? segs : [n.color || '#64748b'];
      for (const c of allColors) {
        const key = normColor(c);
        const cur = map.get(key) || { color: c, key, titles: [], count: 0 };
        cur.count++;
        // garde les 2 premiers titres où cette couleur apparaît (même si n est divisé, on liste ses titres une seule fois par couleur)
        if (cur.titles.length < 2) {
          const t = n.title?.trim() || 'Sans titre';
          if (!cur.titles.includes(t)) cur.titles.push(t);
        }
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [nodes]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !onResize) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      onResize(dragRef.current.startW - dx, dragRef.current.startH + dy);
    },
    [onResize]
  );

  if (colors.length === 0) return null;

  const startEdit = (key: string, current: string) => {
    setEditing(key);
    setDraft(current);
  };

  const commit = (key: string) => {
    onRenameGroup?.(key, draft.trim());
    setEditing(null);
  };

  return (
    <div
      className="relative rounded-xl border border-white/10 bg-[#12121a]/90 backdrop-blur-xl shadow-xl overflow-hidden"
      style={{ width, maxWidth: 'min(420px, 90vw)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
      >
        <SwatchBook size={13} className="text-pink-300/70" />
        <span className="flex-1 text-[11px] font-semibold text-white/70">
          Légende des concepts
        </span>
        <span className="text-[10px] text-white/30">{colors.length} couleurs</span>
        {open ? (
          <ChevronDown size={13} className="text-white/30" />
        ) : (
          <ChevronUp size={13} className="text-white/30" />
        )}
      </button>
      {open && (
        <div
          className="px-2.5 pb-2.5 space-y-1.5 overflow-y-auto"
          style={{ maxHeight: Math.max(60, height - 40) }}
        >
          <p className="text-[9px] text-white/25 px-0.5">
            Groupes par couleur — double-clic pour renommer
          </p>
          {colors.map((entry) => {
            const groupName =
              groupLabels[entry.key] ||
              groupLabels[entry.color.toLowerCase()] ||
              '';
            const isEdit = editing === entry.key;
            return (
              <div
                key={entry.key}
                className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-white/[0.03] min-w-0"
              >
                <span
                  className="w-4 h-4 rounded-md shrink-0 border border-white/20 shadow-inner"
                  style={{ background: entry.color }}
                  title={entry.color}
                />
                <div className="min-w-0 flex-1">
                  {isEdit ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commit(entry.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(entry.key);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      placeholder="Nom du groupe…"
                      className="w-full bg-white/10 border border-pink-400/40 rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onDoubleClick={() =>
                        startEdit(
                          entry.key,
                          groupName || `Groupe ${entry.color}`
                        )
                      }
                      onClick={() =>
                        onRenameGroup &&
                        startEdit(entry.key, groupName || '')
                      }
                      className="text-left w-full min-w-0"
                      title="Cliquer pour renommer le groupe"
                    >
                      <div className="text-[11px] text-white/75 font-medium truncate">
                        {groupName || (
                          <span className="text-white/35 italic">
                            Sans nom…
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-white/30 truncate">
                        {entry.titles.join(' · ')}
                        {entry.count > entry.titles.length ? '…' : ''}
                      </div>
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-mono text-white/35 shrink-0">
                  ×{entry.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {onResize && open && (
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              startW: width,
              startH: height,
            };
          }}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => {
            dragRef.current = null;
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {/* */}
          }}
          className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
          style={{
            background:
              'linear-gradient(135deg, transparent 50%, rgba(236,72,153,0.55) 50%)',
          }}
          title="Redimensionner"
        />
      )}
    </div>
  );
}

/** Petit bouton œil pour afficher/masquer une légende */
export function LegendToggleBtn({
  label,
  visible,
  onToggle,
  activeClass = 'text-violet-200',
}: {
  label: string;
  visible: boolean;
  onToggle: () => void;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? `Masquer ${label}` : `Afficher ${label}`}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border transition-colors ${
        visible
          ? `bg-white/8 border-white/15 ${activeClass}`
          : 'bg-transparent border-white/8 text-white/35 hover:text-white/55'
      }`}
    >
      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
      {label}
    </button>
  );
}
