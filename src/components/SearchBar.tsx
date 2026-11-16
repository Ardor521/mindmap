import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, X, Navigation, Link2, Check } from 'lucide-react';
import type { KnowledgeNode, KnowledgeEdge } from '../lib/types';
import { searchNodes } from '../lib/ai';

export function SearchBar({
  nodes,
  onSelect,
  connectMode = false,
  connectFrom = null,
  connectFromTitle,
  onConnectPick,
  edges = [],
}: {
  nodes: KnowledgeNode[];
  onSelect: (id: string) => void;
  connectMode?: boolean;
  connectFrom?: string | null;
  connectFromTitle?: string;
  onConnectPick?: (id: string) => void;
  edges?: KnowledgeEdge[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const alreadyLinkedSet = useMemo(() => {
    if (!connectMode || !connectFrom) return new Set<string>();
    const s = new Set<string>();
    for (const e of edges) {
      if (e.source === connectFrom) s.add(e.target);
      else if (e.target === connectFrom) s.add(e.source);
    }
    return s;
  }, [connectMode, connectFrom, edges]);

  // exclude the source itself from results when in connect mode
  const rawResults = query.trim() ? searchNodes(nodes, query).slice(0, 8) : [];
  const results = useMemo(() => {
    if (!connectMode || !connectFrom) return rawResults;
    return rawResults.filter((n) => n.id !== connectFrom);
  }, [rawResults, connectMode, connectFrom]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // when entering connect mode, auto-focus the search bar for quick search
  useEffect(() => {
    if (connectMode) {
      // small delay so Toolbar click doesn't blur
      const t = setTimeout(() => {
        inputRef.current?.focus();
        setOpen(true);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [connectMode]);

  useEffect(() => setActive(0), [query]);

  // close on click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = inputRef.current?.closest('div');
      const panel = document.querySelector('[data-search-panel]');
      if (
        el &&
        !el.contains(e.target as Node) &&
        panel &&
        !panel.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (id: string) => {
    if (connectMode && onConnectPick) {
      onConnectPick(id);
      setQuery('');
      setOpen(true);
      // keep focus for chaining multiple links
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      onSelect(id);
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const placeholder = connectMode
    ? connectFromTitle
      ? `Lier à « ${connectFromTitle} » — recherche une cible…`
      : 'Rechercher la source à lier…'
    : 'Rechercher un concept…';

  return (
    <div className="relative w-full max-w-md">
      <div
        className={`flex items-center gap-2 px-3.5 h-10 rounded-xl border backdrop-blur-xl shadow-lg transition-colors ${
          connectMode
            ? 'bg-violet-500/10 border-violet-500/40 ring-2 ring-violet-500/20'
            : open
              ? 'bg-[#12121a]/85 border-violet-500/40 ring-2 ring-violet-500/20'
              : 'bg-[#12121a]/85 border-white/10 hover:border-white/20'
        }`}
      >
        {connectMode ? (
          <Link2 size={15} className="text-violet-300 shrink-0" />
        ) : (
          <Search size={15} className="text-white/40 shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              pick(results[active].id);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none"
        />
        {connectMode && connectFromTitle && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-200 truncate max-w-[110px]">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            {connectFromTitle}
          </span>
        )}
        {query ? (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="text-white/30 hover:text-white/60 p-0.5"
          >
            <X size={14} />
          </button>
        ) : connectMode ? (
          <span className="text-[10px] text-violet-300/70 font-mono border border-violet-500/20 px-1.5 py-0.5 rounded">
            ↔ Lier
          </span>
        ) : (
          <kbd className="hidden sm:inline text-[10px] text-white/25 font-mono px-1.5 py-0.5 rounded border border-white/10">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Hint when in connect mode and empty */}
      {connectMode && open && !query.trim() && (
        <div
          data-search-panel
          className="absolute top-full mt-2 w-full rounded-xl border border-violet-500/20 bg-[#12121a]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 p-3"
        >
          <p className="text-xs text-white/50 leading-relaxed">
            {connectFrom
              ? `Tape le nom de la cible — ou clique un concept sur la carte. Tu peux enchaîner plusieurs liaisons.`
              : `Recherche la source, puis la cible. Entrée pour lier, Echap pour quitter le mode.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nodes.slice(0, 6).map((n) => (
              <button
                key={n.id}
                onClick={() => pick(n.id)}
                className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-violet-500/15 hover:border-violet-500/30 hover:text-violet-200 transition-colors truncate max-w-[120px]"
              >
                {n.title || 'Sans titre'}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && results.length > 0 && (
        <div
          data-search-panel
          className="absolute top-full mt-2 w-full rounded-xl border border-white/10 bg-[#12121a]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
        >
          {connectMode && (
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-violet-300/70 border-b border-white/5 flex items-center justify-between">
              <span>{connectFrom ? 'Cibles suggérées — cliquer pour lier' : 'Sources — cliquer pour choisir'}</span>
              <span className="text-white/25">{results.length} résultats</span>
            </div>
          )}
          {results.map((n, i) => {
            const isLinked = alreadyLinkedSet.has(n.id);
            const isActive = i === active;
            return (
              <button
                key={n.id}
                onClick={() => pick(n.id)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-violet-500/12' : 'hover:bg-white/5'
                } ${isLinked ? 'opacity-60' : ''}`}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90 font-medium truncate flex items-center gap-1.5">
                    {n.title || 'Sans titre'}
                    {isLinked && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/20">
                        <Check size={10} /> déjà lié
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/35 truncate">
                    {n.description || (n.tags?.length ? n.tags.join(' · ') : '—')}
                  </div>
                </div>
                {connectMode ? (
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border font-medium ${
                      isActive
                        ? 'bg-violet-500 text-white border-violet-500'
                        : 'bg-white/5 border-white/10 text-white/50'
                    }`}
                  >
                    <Link2 size={11} />
                    {isLinked ? 'Relier quand même' : 'Lier'}
                  </span>
                ) : (
                  <Navigation size={12} className="text-white/25 shrink-0" />
                )}
              </button>
            );
          })}
          {connectMode && (
            <div className="px-3 py-2 text-[11px] text-white/25 border-t border-white/5 text-center">
              Entrée pour lier le surligné · Echap pour quitter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
