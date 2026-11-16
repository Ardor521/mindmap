import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Trash2, Plus, ExternalLink, Sparkles, Tag, Link2, FileText, StickyNote, Link as LinkIcon, ImagePlus, Image as ImageIcon, Search, Check, Layers, Maximize2, Minimize2, Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KnowledgeNode, RelationType, GraphData, Resource, RelationTypeDef } from '../lib/types';
import { PLACEHOLDER_DESC, PLACEHOLDER_TITLE, getAllRelationTypes, getRelationMeta } from '../lib/types';
import { getNeighbors, searchNodes } from '../lib/ai';
import { ICON_OPTIONS } from './NodeCard';
import { ColorPalette } from './ColorPalette';
import { ScaleControls } from './ScaleControls';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SidePanel({
  node, graph, customColors, onClose, onUpdate, onDelete, onAddChild, onAddParent, onExpandAI, onNavigate,
  onDeleteEdge, onUpdateEdge, onConnect, onStartConnect, onAddCustomColor, onRemoveCustomColor, onRequestDelete,
  favoriteIcons = [], onToggleFavoriteIcon, onSelectEdge, relationColors = {}, customRelationTypes = [],
}: {
  node: KnowledgeNode | null; graph: GraphData; customColors: string[];
  onClose: () => void; onUpdate: (id: string, patch: Partial<KnowledgeNode>) => void; onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void; onAddParent?: (childId: string) => void; onExpandAI: (parentId: string) => void;
  onNavigate: (id: string) => void; onDeleteEdge: (id: string) => void;
  onUpdateEdge: (id: string, patch: { type?: RelationType; label?: string }) => void;
  onConnect: (source: string, target: string, type: RelationType, label?: string) => void;
  onStartConnect: (fromId: string) => void; onAddCustomColor: (c: string) => void; onRemoveCustomColor: (c: string) => void;
  onRequestDelete?: (ids: string[]) => void; favoriteIcons?: string[]; onToggleFavoriteIcon?: (icon: string) => void;
  onSelectEdge?: (edgeId: string) => void; relationColors?: Partial<Record<string, string>>; customRelationTypes?: RelationTypeDef[];
}) {
  const relationTypes = getAllRelationTypes(customRelationTypes, undefined, relationColors);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [rightTab, setRightTab] = useState<'info' | 'relations'>('info');
  const [fullscreenNotes, setFullscreenNotes] = useState(false);
  const [linkTarget, setLinkTarget] = useState('');
  const [linkType, setLinkType] = useState<RelationType>('related');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkQueryActive, setLinkQueryActive] = useState(0);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageLightbox, setImageLightbox] = useState(false);
  const [isImageDragOver, setIsImageDragOver] = useState(false);
  const [showColorEditor, setShowColorEditor] = useState(false);
  const imageZoneRef = useRef<HTMLDivElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const draftNodeIdRef = useRef<string | null>(null);
  const draftRef = useRef({ title: '', description: '', notes: '' });
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const flushDraft = useCallback(() => {
    const id = draftNodeIdRef.current;
    if (!id) return;
    const d = draftRef.current;
    onUpdateRef.current(id, { title: d.title, description: d.description, notes: d.notes });
  }, []);

  useEffect(() => {
    flushDraft();
    draftNodeIdRef.current = node?.id ?? null;
    if (node) {
      setTitle(node.title); setDescription(node.description); setNotes(node.notes);
      setImageUrlInput(node.imageUrl?.startsWith('data:') ? '' : (node.imageUrl ?? ''));
      setImageLightbox(false);
      setFullscreenNotes(false);
      setShowColorEditor(false);
      setLinkTarget(''); setLinkLabel(''); setLinkQuery(''); setLinkQueryActive(0);
      draftRef.current = { title: node.title, description: node.description, notes: node.notes };
    } else draftRef.current = { title: '', description: '', notes: '' };
  }, [node?.id]);

  useEffect(() => {
    if (node && fullscreenNotes) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [node, fullscreenNotes]);

  useEffect(() => {
    if (!node) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !imageLightbox) {
        if (fullscreenNotes) setFullscreenNotes(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [node, imageLightbox, onClose, fullscreenNotes]);

  const neighbors = useMemo(() => (node ? getNeighbors(node.id, graph) : []), [node, graph]);
  const allLinkableNodes = useMemo(() => {
    if (!node) return [];
    const linked = new Set<string>([node.id]);
    neighbors.forEach(({ node: n }) => linked.add(n.id));
    return graph.nodes.filter((n) => !linked.has(n.id));
  }, [graph.nodes, neighbors, node]);
  const linkSearchResults = useMemo(() => {
    if (!node) return [];
    const q = linkQuery.trim();
    if (!q) return allLinkableNodes.slice(0, 8);
    const hits = searchNodes(allLinkableNodes, q).slice(0, 8);
    if (hits.length) return hits;
    const low = q.toLowerCase();
    return allLinkableNodes.filter((n) => (n.title || '').toLowerCase().includes(low)).slice(0, 8);
  }, [allLinkableNodes, linkQuery, node]);

  if (!node) return null;
  const commit = (patch: Partial<KnowledgeNode>) => {
    if (draftNodeIdRef.current !== node.id) return;
    onUpdate(node.id, patch);
  };
  const setTitleDraft = (v: string) => { setTitle(v); draftRef.current = { ...draftRef.current, title: v }; };
  const setDescriptionDraft = (v: string) => { setDescription(v); draftRef.current = { ...draftRef.current, description: v }; };
  const setNotesDraft = (v: string) => { setNotes(v); draftRef.current = { ...draftRef.current, notes: v }; };

  const commitImageFile = async (file: File) => {
    if (!file?.type.startsWith('image/')) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      // flush draft title/description so we don't lose edits when we commit imageUrl
      if (draftNodeIdRef.current === node.id) {
        onUpdate(node.id, {
          title: draftRef.current.title,
          description: draftRef.current.description,
          notes: draftRef.current.notes,
          imageUrl: dataUrl,
        });
        // sync local state so the preview updates immediately
        setImageUrlInput('');
      } else {
        commit({ imageUrl: dataUrl });
      }
    } catch {}
  };

  const handleImagePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const img = items.find((it) => it.type.startsWith('image/'));
    if (!img) return;
    e.preventDefault();
    const file = img.getAsFile();
    if (file) await commitImageFile(file);
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    setIsImageDragOver(false);
    await commitImageFile(f);
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    const hasImg = Array.from(e.dataTransfer.types).includes('Files');
    if (!hasImg) return;
    e.preventDefault();
    setIsImageDragOver(true);
  };

  const addResource = () => {
    const t = resourceTitle.trim(), u = resourceUrl.trim();
    if (!t || !u) return;
    commit({ resources: [...node.resources, { id: `r-${Date.now()}`, title: t, url: u, type: 'link' }] });
    setResourceTitle(''); setResourceUrl('');
  };

  return (
    <AnimatePresence mode="wait">
      {fullscreenNotes ? (
        <div key="fullscreen-notes" className="fixed inset-0 z-[85] flex" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
          <style>{`@supports not ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px))) { .ku-glass { background: rgba(7,7,12,0.88) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } }`}</style>
          <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} className="ku-glass absolute inset-0 bg-[#06070a]/[0.58] backdrop-blur-[12px]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={() => setFullscreenNotes(false)} aria-hidden />
          <motion.div key="overlay-tint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(900px 500px at 50% -10%, rgba(124,58,237,0.10), transparent 62%), linear-gradient(to bottom, rgba(0,0,0,0.18), transparent 42%, rgba(0,0,0,0.22))' }} />
          <motion.div key="window" initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.988 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="relative flex flex-col w-full h-full overflow-hidden border border-white/[0.07] shadow-[0_32px_90px_rgba(0,0,0,0.62),0_1px_0_rgba(255,255,255,0.06)_inset]" style={{ background: 'linear-gradient(180deg, rgba(18,18,26,0.96) 0%, rgba(14,14,20,0.97) 100%)' }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] opacity-[0.9]" style={{ background: 'radial-gradient(900px 220px at 28% 0%, rgba(124,58,237,0.10), transparent 70%), radial-gradient(700px 260px at 82% 0%, rgba(251,146,60,0.06), transparent 68%)' }} />
            <div className="relative shrink-0 flex items-start gap-4 sm:gap-5 px-5 sm:px-8 lg:px-10 py-5 sm:py-6 border-b border-white/[0.07] bg-gradient-to-r from-white/[0.02] via-transparent to-transparent">
              <div className="hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center shrink-0 overflow-hidden border" style={{ background: `${node.color}14`, borderColor: `${node.color}26` }}>
                {node.imageUrl ? (<button type="button" onClick={() => setImageLightbox(true)} className="w-full h-full cursor-zoom-in"><img src={node.imageUrl} alt="" className="w-full h-full object-cover" /></button>) : (<div className="w-3.5 h-3.5 rounded-full" style={{ background: node.color }} />)}
              </div>
              <div className="sm:hidden w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border" style={{ background: `${node.color}14`, borderColor: `${node.color}26` }}>
                {node.imageUrl ? (<button type="button" onClick={() => setImageLightbox(true)} className="w-full h-full cursor-zoom-in"><img src={node.imageUrl} alt="" className="w-full h-full object-cover" /></button>) : (<div className="w-3 h-3 rounded-full" style={{ background: node.color }} />)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/30 font-semibold mb-1.5">Notes — {node.title || 'Sans titre'}</div>
                <div className="text-[20px] sm:text-[26px] lg:text-[28px] font-semibold tracking-tight leading-tight text-white truncate">{node.title || 'Sans titre'}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/55 font-medium"><Layers size={11} className="text-white/40" /> Profondeur {node.depth}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/55 font-mono"><Maximize2 size={11} className="text-white/40" /> ×{node.scale >= 0.01 && node.scale < 100 ? node.scale.toFixed(2) : node.scale.toExponential(1)}</span>
                  <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/15 text-violet-300"><Eye size={11} /> Plein écran — Échap pour réduire</span>
                </div>
              </div>
              <button onClick={() => setFullscreenNotes(false)} className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.10] hover:border-white/15 text-sm font-medium transition-colors duration-200" title="Réduire (Échap)"><Minimize2 size={16} /> Réduire</button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="w-full max-w-[860px] mx-auto p-5 sm:p-8 lg:p-10">
                <label className="text-[11px] uppercase tracking-[0.14em] text-white/30 font-semibold">Notes privées — {node.title || 'Sans titre'}</label>
                <textarea value={notes} onChange={(e) => setNotesDraft(e.target.value)} onBlur={() => { if (draftNodeIdRef.current === node.id && notes !== node.notes) commit({ notes }); }} rows={22} placeholder="Écris tes notes, idées, sources… (sauvegarde auto au clic hors champ)" className="mt-3 w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-5 text-[15px] leading-relaxed text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/30 focus:bg-white/[0.06] resize-none min-h-[58vh] transition-colors duration-200" />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-white/25">Sauvegarde automatique · Échap ou clic fond pour réduire · Même contenu que le panneau gauche</p>
                  <span className="hidden sm:inline text-xs text-white/20">{notes.length} caractères</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 p-4 sm:px-8 lg:px-10 sm:py-4 border-t border-white/[0.07] bg-[#0a0a0f]/60 backdrop-blur-sm flex items-center justify-between gap-3">
              <button onClick={() => setFullscreenNotes(false)} className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors duration-200"><Minimize2 size={14}/> Réduire en panneau gauche</button>
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-xs text-white/25">{graph.nodes.length} concepts · {graph.edges.length} liens</span>
                <button onClick={() => setFullscreenNotes(false)} className="px-5 sm:px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-100 shadow-[0_8px_20px_rgba(255,255,255,0.08)] transition-colors duration-200">Réduire</button>
              </div>
            </div>
          </motion.div>
          {imageLightbox && node.imageUrl && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-md" onClick={() => setImageLightbox(false)} role="dialog" aria-modal="true">
              <button type="button" onClick={() => setImageLightbox(false)} className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:bg-white/15 transition-colors duration-200"><X size={18} /></button>
              <img src={node.imageUrl} alt={node.title || 'Image'} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/10 cursor-zoom-out" onClick={(e) => e.stopPropagation()} />
            </motion.div>
          )}
        </div>
      ) : (
        <>
          <motion.aside key="notes-panel-left" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -12, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="absolute top-16 left-4 bottom-4 w-[360px] max-w-[min(360px,calc(100vw-2rem))] z-[79] hidden lg:flex flex-col rounded-2xl border border-white/10 bg-[#12121a]/97 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-black/40">
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/8 bg-white/[0.02]">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0"><StickyNote size={13} className="text-amber-300/80" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white/90 truncate">Notes</div>
                <div className="text-[11px] text-white/30 truncate">{node.title || 'Sans titre'}</div>
              </div>
              <button onClick={() => setFullscreenNotes(true)} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-200 text-xs font-medium hover:bg-violet-500/25 hover:text-white transition-colors duration-200" title="Plein écran"><Maximize2 size={13}/> Plein écran</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold flex items-center justify-between">Notes privées <span className="text-[10px] font-normal text-white/20">{notes.length} car.</span></label>
                <textarea value={notes} onChange={(e) => setNotesDraft(e.target.value)} onBlur={() => { if (draftNodeIdRef.current === node.id && notes !== node.notes) commit({ notes }); }} rows={14} placeholder="Écris tes notes, idées, sources… (sauvegarde auto)" className="mt-1.5 w-full rounded-xl bg-white/4 border border-white/8 px-3 py-2.5 text-sm text-white/80 outline-none focus:border-violet-500/30 focus:bg-white/[0.06] resize-none leading-relaxed placeholder:text-white/30 transition-colors duration-200" />
                <p className="text-[11px] text-white/25 mt-2 leading-relaxed">Raccourci : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[10px] text-white/60"><Maximize2 size={10}/> Plein écran</span> pour éditer en immersif. Même sauvegarde.</p>
              </div>
              <button onClick={() => setFullscreenNotes(true)} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 border border-violet-500/20 text-sm font-medium text-violet-200 hover:from-violet-500/20 hover:to-fuchsia-500/15 hover:text-white transition-colors duration-200"><Maximize2 size={14}/> Ouvrir en plein écran</button>
            </div>
          </motion.aside>
          <motion.aside key="side-panel" initial={{ x: 16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 12, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="absolute top-16 right-4 bottom-4 w-[360px] max-w-[min(360px,calc(100vw-2rem))] lg:max-w-[360px] z-[80] flex flex-col rounded-2xl border border-white/10 bg-[#12121a]/97 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-black/40">
            <div className="flex items-start gap-3 p-4 border-b border-white/8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: `${node.color}22`, border: `1px solid ${node.color}44` }}>
                {node.imageUrl ? (<button type="button" onClick={() => setImageLightbox(true)} className="w-full h-full cursor-zoom-in"><img src={node.imageUrl} alt="" className="w-full h-full object-cover" /></button>) : (<div className="w-3 h-3 rounded-full" style={{ background: node.color }} />)}
              </div>
              <div className="flex-1 min-w-0">
                <input value={title} onChange={(e) => setTitleDraft(e.target.value)} onFocus={(e) => { if (title === PLACEHOLDER_TITLE || title === 'Premier concept' || title === 'Sous-concept') setTitleDraft(''); const el = e.target; requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)); }} onBlur={() => { if (draftNodeIdRef.current === node.id && title !== node.title) commit({ title }); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={PLACEHOLDER_TITLE} className="w-full bg-transparent text-base font-semibold text-white/95 outline-none placeholder:text-white/30" />
                <div className="text-[11px] text-white/30 mt-0.5 font-mono">profondeur {node.depth} · échelle {node.scale >= 0.01 && node.scale < 100 ? node.scale.toFixed(2) : node.scale.toExponential(1)}</div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:bg-white/8 hover:text-white transition-colors duration-200"><X size={16} /></button>
            </div>
            <div className="flex border-b border-white/8 px-2">
              {([['info', FileText, 'Info'], ['relations', Link2, 'Liens']] as const).map(([id, Icon, label]) => (
                <button key={id} onClick={() => setRightTab(id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors duration-200 ${rightTab === id ? 'text-violet-300 border-violet-400' : 'text-white/35 border-transparent hover:text-white/60'}`}><Icon size={13} />{label}{id==='relations' && neighbors.length>0 && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-white/10">{neighbors.length}</span>}</button>
              ))}
              <button onClick={() => setFullscreenNotes(true)} className="ml-1.5 my-1.5 inline-flex items-center gap-1 px-2.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-white/40 hover:text-white hover:bg-white/10 hover:border-violet-500/30 transition-colors duration-200 lg:hidden" title="Notes plein écran"><StickyNote size={11}/> Notes</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {rightTab === 'info' && (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Description</label>
                    <textarea value={description} onChange={(e) => setDescriptionDraft(e.target.value)} onBlur={() => { if (draftNodeIdRef.current === node.id && description !== node.description) commit({ description }); }} placeholder={PLACEHOLDER_DESC} rows={4} className="mt-1.5 w-full rounded-xl bg-white/4 border border-white/8 px-3 py-2 text-sm text-white/80 outline-none focus:border-violet-500/40 resize-none leading-relaxed placeholder:text-white/30 transition-colors duration-200" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold flex items-center gap-1"><ImageIcon size={10} /> Image</label>
                    <div
                      ref={imageZoneRef}
                      onPaste={handleImagePaste}
                      onDrop={handleImageDrop}
                      onDragOver={handleImageDragOver}
                      onDragLeave={() => setIsImageDragOver(false)}
                      tabIndex={0}
                      className={`mt-1.5 rounded-xl border-2 border-dashed bg-black/20 p-1.5 outline-none transition-colors ${isImageDragOver ? 'border-violet-400/50 bg-violet-500/10' : 'border-white/10 hover:border-white/15 focus-within:border-violet-400/40 focus-within:bg-violet-500/[0.06]'}`}
                    >
                    {node.imageUrl ? (
                      <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/30 group/img">
                        <button type="button" onClick={() => setImageLightbox(true)} className="absolute inset-0 w-full h-full cursor-zoom-in"><img src={node.imageUrl} alt="" className="w-full h-full object-cover" /><span className="absolute inset-x-0 bottom-0 py-1.5 text-center text-[10px] text-white/80 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">Cliquer pour agrandir</span></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); commit({ imageUrl: undefined }); setImageUrlInput(''); }} className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white transition-colors duration-200"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-white/[0.02] px-3 py-6 text-center">
                        <ImageIcon size={18} className="mx-auto text-white/20" />
                        <p className="mt-1 text-xs font-medium text-white/50">Colle une image <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-white/10 border border-white/15">Ctrl+V</span> ici</p>
                        <p className="text-[11px] text-white/25">ou glisse-la depuis ton explorateur</p>
                      </div>
                    )}
                    <div className={`mt-2 flex gap-1.5 ${node.imageUrl ? '' : 'opacity-60'}`}>
                      <input value={imageUrlInput.startsWith('data:') ? '' : imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} onPaste={(e) => { const text = e.clipboardData.getData('text'); if (text.trim().startsWith('data:image')) { e.preventDefault(); commit({ imageUrl: text.trim() }); } }} onBlur={() => { const u = imageUrlInput.trim(); if (u && u !== node.imageUrl && !u.startsWith('data:')) commit({ imageUrl: u }); }} placeholder="Ou colle une URL d'image…" className="flex-1 rounded-lg bg-white/4 border border-white/8 px-2.5 py-1.5 text-xs text-white/80 outline-none transition-colors duration-200 placeholder:text-white/25" />
                      <button type="button" onClick={() => imageFileRef.current?.click()} className="px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 text-white/60 hover:bg-white/10 transition-colors duration-200"><ImagePlus size={14} /></button>
                      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f?.type.startsWith('image/')) return; await commitImageFile(f); e.target.value = ''; }} />
                    </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold flex items-center gap-1"><Tag size={10} /> Tags</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {node.tags.map((t) => (<span key={t} className="group flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: `${node.color}18`, color: node.color, border: `1px solid ${node.color}30` }}>{t}<button onClick={() => commit({ tags: node.tags.filter((x) => x !== t) })} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"><X size={10} /></button></span>))}
                    </div>
                    <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const t = tagInput.trim().toLowerCase(); if (t && !node.tags.includes(t)) { commit({ tags: [...node.tags, t] }); setTagInput(''); } }}>
                      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Tag…" className="flex-1 rounded-lg bg-white/4 border border-white/8 px-2.5 py-1.5 text-xs text-white/80 outline-none" />
                      <button type="submit" className="p-1.5 rounded-lg bg-white/6 text-white/50 hover:bg-white/10 transition-colors duration-200"><Plus size={14} /></button>
                    </form>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                    <button type="button" onClick={() => setShowColorEditor((v) => !v)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors">
                      <span className="w-6 h-6 rounded-full border border-white/15 shrink-0 flex items-center justify-center overflow-hidden" style={{ background: ((node as any).colorSegments?.length ? `conic-gradient(from 0deg, ${(node as any).colorSegments.map((c:string,i:number,a:string[])=> `${c} ${(i/a.length)*100}% ${((i+1)/a.length)*100}%`).join(', ')})` : node.color) }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-white/80">Couleur {(node as any).colorSegments?.length ? `· ${((node as any).colorSegments as string[]).length} segments` : ''}</div>
                        <div className="text-[10px] text-white/35 truncate">{((node as any).colorSegments?.length ? (node as any).colorSegments.join(' · ') : node.color)}</div>
                      </div>
                      <span className={`text-white/25 text-xs transition-transform ${showColorEditor ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {showColorEditor && (
                      <div className="p-3 space-y-3 border-t border-white/8 bg-[#0a0a0f]/40">
                        <ColorPalette value={node.color} customColors={customColors} onPick={(c) => {
                          const segs = (node as any).colorSegments as string[] | undefined;
                          if (segs && segs.length > 1) {
                            // en mode divisé, le pipette change la première couleur seulement — garde la division
                            const next = [c, ...segs.slice(1)];
                            commit({ color: c, colorSegments: next } as any);
                          } else {
                            commit({ color: c, colorSegments: segs && segs.length ? undefined : (node as any).colorSegments } as any);
                          }
                        }} onAddCustomColor={onAddCustomColor} onRemoveCustomColor={onRemoveCustomColor} />
                        <div className="h-px bg-white/8" />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-white/70 flex items-center gap-1.5">🌈 Diviser ce concept {((node as any).colorSegments?.length ? <span className="text-[10px] font-normal text-violet-300/80">· {((node as any).colorSegments as string[]).length} couleurs</span> : null)}</span>
                            {((node as any).colorSegments?.length ? (
                              <button type="button" onClick={() => commit({ colorSegments: undefined } as any)} className="text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white">Réunifier</button>
                            ) : null)}
                          </div>
                          {((node as any).colorSegments?.length ? (
                            <div className="space-y-2">
                              <div className="h-7 rounded-full overflow-hidden border border-white/10 flex shadow-inner">
                                {((node as any).colorSegments as string[]).map((c:string, i:number) => (
                                  <div key={i} className="flex-1" style={{ background: c }} title={c} />
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {((node as any).colorSegments as string[]).map((c:string, i:number) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 pl-1 pr-1 py-0.5 rounded-full border text-[11px] font-mono" style={{ background: `${c}18`, borderColor: `${c}40`, color: c }}>
                                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: c }} />{c}
                                    <button type="button" onClick={() => {
                                      const segs = [...((node as any).colorSegments as string[])];
                                      segs.splice(i,1);
                                      if (segs.length < 2) commit({ colorSegments: undefined, color: segs[0] ?? node.color } as any);
                                      else commit({ colorSegments: segs, color: segs[0] } as any);
                                    }} className="ml-0.5 w-4 h-4 rounded-full bg-black/30 text-white/60 hover:text-white flex items-center justify-center leading-none">×</button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {['#6366f1','#8b5cf6','#ec4899','#f59e0b','#22c55e','#06b6d4','#f43f5e','#eab308'].filter(c => !((node as any).colorSegments as string[]).map((x:string)=>x.toLowerCase()).includes(c.toLowerCase())).slice(0,6).map(c => (
                                  <button key={c} type="button" onClick={() => {
                                    const segs = [...((node as any).colorSegments as string[]), c];
                                    commit({ colorSegments: segs, color: segs[0] } as any);
                                  }} className="w-6 h-6 rounded-full border border-white/15 hover:scale-110 transition-transform" style={{ background: c }} title={`Ajouter ${c}`} />
                                ))}
                                <label className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/60 hover:bg-white/10 cursor-pointer">
                                  <input type="color" className="sr-only" onChange={(e) => {
                                    const segs = [...((node as any).colorSegments as string[]), e.target.value];
                                    commit({ colorSegments: segs, color: segs[0] } as any);
                                  }} />
                                  + pipette
                                </label>
                              </div>
                              <p className="text-[10px] leading-relaxed text-white/25">Chaque couleur est un segment du même bloc (rendu en <span className="text-white/40">conic-gradient</span> sur la carte). Nombre infini, sans répétition.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] leading-relaxed text-white/35">Découpe ce concept en <span className="text-white/60">autant de couleurs que tu veux</span> — le bloc reste unique mais s’affiche en parts égales (camembert).</p>
                              <div className="flex flex-wrap gap-1.5">
                                {['#6366f1','#8b5cf6','#ec4899','#f59e0b','#22c55e','#06b6d4','#f43f5e','#eab308'].filter(c => c.toLowerCase() !== node.color.toLowerCase()).slice(0,8).map(c => (
                                  <button key={c} type="button" onClick={() => commit({ colorSegments: [node.color, c], color: node.color } as any)} className="w-7 h-7 rounded-full border border-white/15 hover:scale-110 transition-transform" style={{ background: c }} title={`Diviser avec ${c}`} />
                                ))}
                              </div>
                              <button type="button" onClick={() => commit({ colorSegments: [node.color, '#22c55e'], color: node.color } as any)} className="w-full py-2 rounded-lg bg-violet-500/15 border border-violet-500/25 text-xs font-medium text-violet-200 hover:bg-violet-500/25">Diviser en 2 couleurs → ajouter à l’infini</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Rôle</label>
                    <button type="button" onClick={() => commit({ isPrimary: !node.isPrimary })} className={`mt-1.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-colors duration-200 ${node.isPrimary ? 'bg-amber-500/20 border-amber-400/45 text-amber-100' : 'bg-white/5 border-white/10 text-white/55 hover:bg-white/8'}`}>★ {node.isPrimary ? 'Concept principal' : 'Marquer comme principal'}</button>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Icône</label>
                    {favoriteIcons.length > 0 && (<div className="mt-1.5 mb-2 flex flex-wrap gap-1">{favoriteIcons.map((icon) => (<button key={icon} type="button" onClick={() => commit({ icon })} className={`px-2 py-1 rounded-md text-[10px] border transition-colors duration-200 ${node.icon === icon ? 'bg-amber-500/20 border-amber-400/40 text-amber-100' : 'bg-amber-500/10 border-amber-500/25 text-amber-200/80'}`}>★ {icon}</button>))}</div>)}
                    <div className="mt-1.5 flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                      {ICON_OPTIONS.map((icon) => { const isFav = favoriteIcons.includes(icon); return (<div key={icon} className="relative group/icon"><button type="button" onClick={() => commit({ icon })} className={`px-2 py-1 rounded-md text-[10px] border transition-colors duration-200 ${node.icon === icon ? 'bg-violet-500/20 border-violet-400/40 text-violet-200' : 'bg-white/4 border-white/8 text-white/40 hover:bg-white/10'}`}>{icon}</button>{onToggleFavoriteIcon && (<button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavoriteIcon(icon); }} className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border text-[8px] opacity-0 group-hover/icon:opacity-100 transition-opacity duration-200 ${isFav ? 'bg-amber-500/30 border-amber-400/50 text-amber-200' : 'bg-[#1a1a24] border-white/20 text-white/40'}`}>★</button>)}</div>); })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Échelle (par rapport au parent)</label>
                    <div className="mt-1.5"><ScaleControls node={node} allNodes={graph.nodes} onSetScale={(scale) => commit({ scale })} /></div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Forme du bloc</label>
                    <p className="text-[10px] text-white/30 mt-1 mb-2">Largeur et hauteur indépendantes (1 = carré)</p>
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-white/45">Largeur</span><span className="font-mono text-violet-300/90">{(node.wFactor ?? 1).toFixed(2)}×</span></div>
                        <input type="range" min={0.45} max={2.8} step={0.05} value={node.wFactor ?? 1} onChange={(e) => commit({ wFactor: Number(e.target.value) })} className="w-full accent-violet-400" />
                        <div className="flex gap-1 mt-1">{[0.6, 1, 1.4, 2].map((v) => (<button key={`w-${v}`} type="button" onClick={() => commit({ wFactor: v })} className={`flex-1 py-1 rounded-md text-[10px] border transition-colors duration-200 ${Math.abs((node.wFactor ?? 1) - v) < 0.06 ? 'bg-violet-500/20 border-violet-400/40 text-violet-100' : 'bg-white/4 border-white/8 text-white/40'}`}>{v}×</button>))}</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-white/45">Hauteur</span><span className="font-mono text-violet-300/90">{(node.hFactor ?? 1).toFixed(2)}×</span></div>
                        <input type="range" min={0.45} max={2.8} step={0.05} value={node.hFactor ?? 1} onChange={(e) => commit({ hFactor: Number(e.target.value) })} className="w-full accent-violet-400" />
                        <div className="flex gap-1 mt-1">{[0.6, 1, 1.4, 2].map((v) => (<button key={`h-${v}`} type="button" onClick={() => commit({ hFactor: v })} className={`flex-1 py-1 rounded-md text-[10px] border transition-colors duration-200 ${Math.abs((node.hFactor ?? 1) - v) < 0.06 ? 'bg-violet-500/20 border-violet-400/40 text-violet-100' : 'bg-white/4 border-white/8 text-white/40'}`}>{v}×</button>))}</div>
                      </div>
                      <div className="flex gap-1.5"><button type="button" onClick={() => commit({ wFactor: 1, hFactor: 1 })} className="flex-1 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60 hover:bg-white/8 transition-colors duration-200">Carré</button><button type="button" onClick={() => commit({ wFactor: 1.6, hFactor: 0.85 })} className="flex-1 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60 hover:bg-white/8 transition-colors duration-200">Large</button><button type="button" onClick={() => commit({ wFactor: 0.85, hFactor: 1.5 })} className="flex-1 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60 hover:bg-white/8 transition-colors duration-200">Haut</button></div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">Ressources</label>
                    <div className="mt-1.5 space-y-1">
                      {node.resources.map((r) => (<div key={r.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/4 border border-white/6"><a href={r.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center gap-2 text-xs text-white/70 truncate"><ExternalLink size={12} />{r.title}</a><button onClick={() => commit({ resources: node.resources.filter((x) => x.id !== r.id) })} className="opacity-0 group-hover:opacity-100 text-white/30 transition-opacity duration-200"><X size={12} /></button></div>))}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <input value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="Titre" className="w-full rounded-lg bg-white/4 border border-white/8 px-2.5 py-1.5 text-xs text-white/80 outline-none" />
                      <div className="flex gap-1.5"><input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://…" className="flex-1 rounded-lg bg-white/4 border border-white/8 px-2.5 py-1.5 text-xs text-white/80 outline-none" /><button onClick={addResource} className="p-1.5 rounded-lg bg-white/6 text-white/50 hover:bg-white/10 transition-colors duration-200"><Plus size={14} /></button></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <button onClick={() => onAddChild(node.id)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm text-white/70 hover:bg-white/10 transition-colors duration-200"><Plus size={14} /> Sous-concept (enfant)</button>
                    {onAddParent && <button onClick={() => onAddParent(node.id)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-sm text-indigo-200 hover:bg-indigo-500/20 transition-colors duration-200"><Plus size={14} /> Concept parent</button>}
                    <button onClick={() => onExpandAI(node.id)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-sm text-violet-300 hover:bg-violet-500/20 transition-colors duration-200"><Sparkles size={14} /> Générer sous-concepts</button>
                    <button onClick={() => onStartConnect(node.id)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-sm text-cyan-300 hover:bg-cyan-500/15 transition-colors duration-200"><LinkIcon size={14} /> Relier à un autre concept</button>
                  </div>
                </>
              )}
              {rightTab === 'relations' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-white/4 border border-white/8 space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-white/35 font-semibold flex items-center gap-1.5"><Search size={10} /> Nouvelle connexion — recherche rapide</div>
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input value={linkQuery} onChange={(e) => { setLinkQuery(e.target.value); setLinkQueryActive(0); }} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setLinkQueryActive((a) => Math.min(a + 1, linkSearchResults.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setLinkQueryActive((a) => Math.max(a - 1, 0)); } else if (e.key === 'Enter' && linkSearchResults[linkQueryActive]) { e.preventDefault(); setLinkTarget(linkSearchResults[linkQueryActive].id); } }} placeholder="Rechercher un concept…" className="w-full rounded-lg bg-[#0c0c12] border border-white/10 pl-7 pr-7 py-2 text-xs text-white/90 placeholder:text-white/30 outline-none focus:border-violet-500/40 transition-colors duration-200" />
                      {linkQuery ? (<button onClick={() => { setLinkQuery(''); setLinkQueryActive(0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors duration-200"><X size={12} /></button>) : null}
                    </div>
                    <div className="rounded-lg bg-black/30 border border-white/5 max-h-[160px] overflow-y-auto divide-y divide-white/5">
                      {linkSearchResults.length === 0 ? (<div className="px-2.5 py-2 text-[11px] text-white/30">Aucun concept disponible {allLinkableNodes.length === 0 ? '(tout est déjà lié)' : ''}</div>) : (linkSearchResults.map((n, i) => (<button key={n.id} type="button" onClick={() => { setLinkTarget(n.id); }} onMouseEnter={() => setLinkQueryActive(i)} className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors duration-200 ${linkTarget === n.id ? 'bg-violet-500/20 text-violet-100' : i === linkQueryActive ? 'bg-white/6 text-white/90' : 'hover:bg-white/5 text-white/70'}`}><span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} /><span className="flex-1 min-w-0 truncate text-xs font-medium">{n.title || 'Sans titre'}</span>{linkTarget === n.id && <Check size={12} className="text-violet-300 shrink-0" />}</button>)))}
                    </div>
                    {linkTarget && (<div className="text-[11px] text-violet-300/80 px-1 flex items-center gap-1"><Check size={11} /> Sélectionné : <span className="font-medium text-violet-200">{allLinkableNodes.find((n) => n.id === linkTarget)?.title || linkSearchResults.find((n) => n.id === linkTarget)?.title || 'Concept'}</span><button type="button" onClick={() => setLinkTarget('')} className="ml-auto text-white/30 hover:text-white/60 transition-colors duration-200"><X size={11} /></button></div>)}
                    <select value={linkType} onChange={(e) => setLinkType(e.target.value as RelationType)} className="w-full rounded-lg bg-[#0c0c12] border border-white/10 px-2.5 py-2 text-xs text-white/80 transition-colors duration-200">{relationTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                    <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label optionnel…" className="w-full rounded-lg bg-[#0c0c12] border border-white/10 px-2.5 py-2 text-xs text-white/80 transition-colors duration-200" />
                    <button disabled={!linkTarget} onClick={() => { if (!linkTarget) return; onConnect(node.id, linkTarget, linkType, linkLabel.trim() || undefined); setLinkTarget(''); setLinkLabel(''); setLinkQuery(''); }} className="w-full py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/20 disabled:border-violet-500/35 border border-transparent text-xs text-white disabled:text-violet-200/50 font-medium transition-colors duration-200">Créer le lien</button>
                    <p className="text-[10px] text-white/25 px-1">Astuce : tape pour filtrer, ↑↓ + Entrée pour sélectionner, puis choisis le type.</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/35 mb-2">{neighbors.length} connexion{neighbors.length !== 1 ? 's' : ''}</p>
                    <div className="space-y-2">
                      {neighbors.map(({ node: n, edge }) => { const meta = getRelationMeta(edge.type as RelationType, relationColors, customRelationTypes); return (<div key={edge.id} className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white/4 border border-white/6 hover:border-cyan-500/30 cursor-pointer transition-colors duration-200" onClick={() => onSelectEdge?.(edge.id)} title="Ouvrir caractéristiques"><div className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} /><div className="flex-1 min-w-0"><button type="button" onClick={(e) => { e.stopPropagation(); onNavigate(n.id); }} className="text-sm text-white/85 font-medium truncate text-left block w-full hover:text-white transition-colors duration-200">{n.title || 'Sans titre'}</button><div className="text-[10px] mt-0.5 font-medium" style={{ color: meta.color }}>{meta.label}{edge.label ? ` · ${edge.label}` : ''} <span className="text-white/25 font-normal">· clic pour éditer</span></div></div><button type="button" onClick={(e) => { e.stopPropagation(); onDeleteEdge(edge.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-white/25 hover:text-rose-400 transition-all duration-200"><Trash2 size={12} /></button></div>); })}
                    </div>
                  </div>
                  <button onClick={() => onStartConnect(node.id)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-sm text-cyan-300 hover:bg-cyan-500/15 transition-colors duration-200"><LinkIcon size={14} /> Relier sur le canvas</button>
                </div>
              )}
              <div className="lg:hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center">
                <p className="text-xs text-white/40">Tes notes sont à gauche sur desktop</p>
                <button onClick={() => setFullscreenNotes(true)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-200 text-xs">Ouvrir les notes plein écran</button>
              </div>
            </div>
            <div className="p-3 border-t border-white/8">
              <button onClick={() => { if (onRequestDelete) onRequestDelete([node.id]); else if (confirm(`Supprimer « ${node.title || 'Sans titre'} » ?`)) onDelete(node.id); }} className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-300 transition-colors duration-200"><Trash2 size={13} /> Supprimer</button>
            </div>
          </motion.aside>
        </>
      )}
      {imageLightbox && node && node.imageUrl && !fullscreenNotes && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-md" onClick={() => setImageLightbox(false)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setImageLightbox(false)} className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:bg-white/15 transition-colors duration-200"><X size={18} /></button>
          <img src={node.imageUrl} alt={node.title || 'Image'} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/10 cursor-zoom-out" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </AnimatePresence>
  );
}
