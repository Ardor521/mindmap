import { ChevronRight, GitBranch } from 'lucide-react';

export interface BreadcrumbPath {
  rootId: string;
  color: string;
  items: { id: string; title: string }[];
}

interface Props {
  /** Legacy single path */
  items?: { id: string; title: string }[];
  /** All ascent paths (preferred) */
  paths?: BreadcrumbPath[];
  onNavigate: (id: string) => void;
}

export function BreadcrumbNav({ items = [], paths, onNavigate }: Props) {
  const multi = paths && paths.length > 0 ? paths : null;
  if (!multi && items.length === 0) return null;

  if (multi && multi.length > 1) {
    return (
      <div className="flex flex-col gap-1.5 max-w-[min(520px,42vw)]">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30 font-semibold px-0.5">
          <GitBranch size={11} className="text-violet-300/70" />
          {multi.length} chemins vers les racines
        </div>
        <div className="flex flex-col gap-1 max-h-[132px] overflow-y-auto pr-1">
          {multi.map((p, idx) => (
            <nav
              key={`${p.rootId}-${idx}`}
              className="flex items-center gap-0.5 flex-wrap text-xs rounded-lg px-2 py-1 bg-white/[0.03] border border-white/6"
              style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}
            >
              {p.items.map((item, i) => (
                <span key={`${item.id}-${i}`} className="flex items-center gap-0.5 min-w-0">
                  {i > 0 && <ChevronRight size={11} className="text-white/20 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`truncate max-w-[120px] px-1 py-0.5 rounded-md transition-colors ${
                      i === p.items.length - 1
                        ? 'text-white/90 font-medium'
                        : 'text-white/45 hover:text-violet-200 hover:bg-white/5'
                    }`}
                    style={i === 0 ? { color: p.color } : undefined}
                    title={item.title || 'Sans titre'}
                  >
                    {item.title || 'Sans titre'}
                  </button>
                </span>
              ))}
            </nav>
          ))}
        </div>
      </div>
    );
  }

  const single = multi?.[0]?.items ?? items;
  const color = multi?.[0]?.color;
  if (single.length === 0) return null;

  return (
    <nav
      className="flex items-center gap-0.5 flex-wrap text-xs max-w-[min(480px,40vw)]"
      style={color ? { borderLeft: `3px solid ${color}`, paddingLeft: 8 } : undefined}
    >
      {single.map((item, i) => (
        <span key={item.id} className="flex items-center gap-0.5 min-w-0">
          {i > 0 && <ChevronRight size={12} className="text-white/20 shrink-0" />}
          <button
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`truncate max-w-[140px] px-1.5 py-0.5 rounded-md transition-colors ${
              i === single.length - 1
                ? 'text-white/90 font-medium bg-white/5'
                : 'text-white/40 hover:text-violet-200 hover:bg-white/5'
            }`}
            title={item.title || 'Sans titre'}
          >
            {item.title || 'Sans titre'}
          </button>
        </span>
      ))}
    </nav>
  );
}
