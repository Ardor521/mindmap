import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Palette } from 'lucide-react';
import type { KnowledgeEdge, RelationType, RelationTypeDef } from '../lib/types';
import { getAllRelationTypes, getRelationMeta } from '../lib/types';

type LegendEntry = {
  key: string;
  label: string;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  count: number;
  hint?: string;
};

/**
 * Légende fidèle au rendu canvas :
 * - types enregistrés (built-in + custom)
 * - types orphelins présents seulement sur les arêtes
 * - libellés personnalisés d'arêtes (ex. « Classification ») avec la vraie couleur/style
 */
export function LinkLegend({
  relationColors,
  customRelationTypes,
  relationOverrides,
  usedTypes,
  edges = [],
  width = 200,
  height = 200,
  onResize,
}: {
  relationColors?: Partial<Record<string, string>>;
  customRelationTypes?: RelationTypeDef[];
  relationOverrides?: Partial<
    Record<string, { label?: string; color?: string; style?: string; dashed?: boolean }>
  >;
  usedTypes?: Set<RelationType>;
  edges?: KnowledgeEdge[];
  width?: number;
  height?: number;
  onResize?: (w: number, h: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const entries = useMemo(() => {
    const all = getAllRelationTypes(
      customRelationTypes,
      relationOverrides as never,
      relationColors
    );
    const known = new Map(all.map((t) => [t.id, t]));
    const typesInGraph = new Set<string>();
    if (usedTypes) usedTypes.forEach((t) => typesInGraph.add(String(t)));
    for (const e of edges) typesInGraph.add(String(e.type));

    // Group visual appearance: color + style + display label
    const visual = new Map<string, LegendEntry>();

    const addVisual = (
      label: string,
      color: string,
      style: 'solid' | 'dashed' | 'dotted',
      hint?: string
    ) => {
      const key = `${label.toLowerCase()}|${color.toLowerCase()}|${style}`;
      const cur = visual.get(key);
      if (cur) cur.count += 1;
      else
        visual.set(key, {
          key,
          label,
          color,
          style,
          count: 1,
          hint,
        });
    };

    if (edges.length > 0) {
      for (const e of edges) {
        const meta = getRelationMeta(
          e.type,
          relationColors,
          customRelationTypes,
          relationOverrides as never
        );
        const style = (e.style ||
          meta.style ||
          (meta.dashed ? 'dashed' : 'solid')) as 'solid' | 'dashed' | 'dotted';
        const color = e.color || meta.color;
        const customLab = (e.label || '').trim();
        const typeLab = meta.label;
        // Affiche le libellé vu sur le canvas (label d'arête ou type)
        const shown = customLab || typeLab;
        const hint =
          customLab && customLab.toLowerCase() !== typeLab.toLowerCase()
            ? `type : ${typeLab}`
            : !known.has(String(e.type))
              ? 'type non enregistré'
              : undefined;
        addVisual(shown, color, style, hint);
      }
    } else {
      // Fallback types only
      for (const t of all) {
        if (usedTypes && usedTypes.size > 0 && !usedTypes.has(t.id)) continue;
        const meta = getRelationMeta(
          t.id,
          relationColors,
          customRelationTypes,
          relationOverrides as never
        );
        const style = (meta.style ||
          (meta.dashed ? 'dashed' : 'solid')) as 'solid' | 'dashed' | 'dotted';
        addVisual(meta.label, meta.color, style);
      }
    }

    return [...visual.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [
    edges,
    usedTypes,
    customRelationTypes,
    relationOverrides,
    relationColors,
  ]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !onResize) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      onResize(dragRef.current.startW - dx, dragRef.current.startH + dy);
    },
    [onResize]
  );

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
        <Palette size={13} className="text-white/40" />
        <span className="flex-1 text-[11px] font-semibold text-white/70">
          Légende des liens
        </span>
        <span className="text-[10px] text-white/30">{entries.length}</span>
        {open ? (
          <ChevronDown size={13} className="text-white/30" />
        ) : (
          <ChevronUp size={13} className="text-white/30" />
        )}
      </button>
      {open && (
        <div
          className="px-2.5 pb-2.5 space-y-1 overflow-y-auto"
          style={{ maxHeight: Math.max(60, height - 40) }}
        >
          {entries.length === 0 && (
            <p className="text-[10px] text-white/30 px-1">Aucun lien</p>
          )}
          {entries.map((t) => {
            const dash =
              t.style === 'dashed' ? '6 4' : t.style === 'dotted' ? '2 3' : undefined;
            return (
              <div key={t.key} className="flex items-center gap-2 py-0.5 min-w-0">
                <svg width="28" height="10" className="shrink-0">
                  <line
                    x1="2"
                    y1="5"
                    x2="20"
                    y2="5"
                    stroke={t.color}
                    strokeWidth="2"
                    strokeDasharray={dash}
                  />
                  <path d="M18,2 L24,5 L18,8 Z" fill={t.color} />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-white/65 truncate">{t.label}</div>
                  {t.hint && (
                    <div className="text-[8px] text-amber-200/50 truncate">{t.hint}</div>
                  )}
                </div>
                <span className="text-[9px] font-mono text-white/25 shrink-0">
                  ×{t.count}
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
            } catch {
              /* */
            }
          }}
          className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
          style={{
            background:
              'linear-gradient(135deg, transparent 50%, rgba(167,139,250,0.55) 50%)',
          }}
          title="Redimensionner"
        />
      )}
    </div>
  );
}
