
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, GitMerge, HelpCircle, Palette, Plus, Sparkles, Timer } from 'lucide-react';
import { AccountMenu } from '../components/AccountMenu';
import { useAuth } from '../context/AuthContext';
import { loadUserWorkspaces, saveUserWorkspaces } from '../lib/userWorkspaceStore';
import { InfiniteCanvas } from '../components/InfiniteCanvas';
import { SearchBar } from '../components/SearchBar';
import { Toolbar } from '../components/Toolbar';
import { SidePanel } from '../components/SidePanel';
import { BulkEditPanel } from '../components/BulkEditPanel';
import { AIPanel } from '../components/AIPanel';
import { Minimap } from '../components/Minimap';
import { BreadcrumbNav } from '../components/Breadcrumb';
import { HelpOverlay } from '../components/HelpOverlay';
import { DeleteReconnectDialog, type DeletePlan } from '../components/DeleteReconnectDialog';
import { EdgePanel } from '../components/EdgePanel';
import { LinkLegend } from '../components/LinkLegend';
import { ConceptColorLegend, LegendToggleBtn } from '../components/ConceptColorLegend';
import { ChildPicker } from '../components/ChildPicker';
import { LinkBrowsePreview, type BrowseLink } from '../components/LinkBrowsePreview';
import { ExportWorkspacesModal } from '../components/ExportWorkspacesModal';
import { ColorPalette } from '../components/ColorPalette';
import { useGraphStore } from '../hooks/useGraphStore';
import {
  getBreadcrumb,
  getBreadcrumbAlternatives,
  getNeighbors,
  getSelectionContext,
} from '../lib/ai';
import { clampZoom, zoomForNavigation, zoomToFitNode } from '../lib/camera';
import { fitCameraToNodes } from '../lib/layout';
import { saveTextFile, tryAutoSave, hasStoredHandle } from '../lib/saveFile';
import {
  serializeProject, serializeWorkspaceBundle, parseProject, parseWorkspaceBundle, mergeGraphs, mergeMultipleGraphs,
} from '../lib/projectStorage';
import { NewWorkspaceModal, type NewWorkspaceChoice } from '../components/NewWorkspaceModal';
import { createFeatureGuideMindmap } from '../data/featureGuideMindmap';
import {
  buildChronologicalStep,
  createMindmapFromPattern,
  isTimelineGraph,
  type MindmapPatternId,
} from '../data/mindmapPatterns';
import type { Camera, GraphData, MapKind, RelationType } from '../lib/types';

const INITIAL_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

function slugify(name: string): string {
  const s = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s || 'knowledge-universe';
}

export function EditorApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useGraphStore();
  const {
    graph, stats, projectName, mapKind, customColors, relationColors, relationOverrides,
    customRelationTypes, favoriteIcons, legendSize, conceptLegendSize, defaultLinkFontSize, colorGroupLabels, defaultNodeColor,
  } = store;
  const [defaultColorOpen, setDefaultColorOpen] = useState(false);

  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [newWsOpen, setNewWsOpen] = useState(false);
  const [newWsMode, setNewWsMode] = useState<'all' | 'empty-only' | 'guide-only'>('all');
  const [seedFirstNode, setSeedFirstNode] = useState(false);
  const [depthToast, setDepthToast] = useState('');
  const [showLinkLegend, setShowLinkLegend] = useState(false);
  const [showConceptLegend, setShowConceptLegend] = useState(false);
  const [hasFileHandle, setHasFileHandle] = useState(false);
  const [autoSaveHint, setAutoSaveHint] = useState('');
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // triggers re-render to show dirty status
  const [aiOpen, setAiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectType, setConnectType] = useState<RelationType>('related');
  const [multiSelectKind, setMultiSelectKind] = useState<'concepts' | 'edges' | null>(null);
  const [marqueeMode, setMarqueeMode] = useState<'concepts' | 'edges' | null>(null);
  const [flyToRequest, setFlyToRequest] = useState<{ id: string; zoom?: number; token: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [booted, setBooted] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState('');
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [childPicker, setChildPicker] = useState<{ parentId: string; focus: number } | null>(null);
  /** Arrow-key link browse: cycle neighbors, Enter to jump */
  const [linkBrowse, setLinkBrowse] = useState<{
    fromId: string;
    focus: number;
    links: BrowseLink[];
  } | null>(null);
  const [exportWsOpen, setExportWsOpen] = useState(false);
  const [renamingWs, setRenamingWs] = useState(false);
  const [wsNameDraft, setWsNameDraft] = useState('');
  const dirtyRef = useRef(false);
  const lastExportRef = useRef('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mergeFileRef = useRef<HTMLInputElement>(null);
  const [mergeInfo, setMergeInfo] = useState('');
  const projectInputRef = useRef<HTMLInputElement>(null);
  const workspaceSaveTimeoutRef = useRef<number | null>(null);
  const shiftDown = useRef(false);
  const handleAddNodeRef = useRef<() => void>(() => {});
  const navigateByArrowRef = useRef<(key: string) => void>(() => {});
  const undoRef = useRef(store.undo);
  const redoRef = useRef(store.redo);
  undoRef.current = store.undo;
  redoRef.current = store.redo;

  type Workspace = { id: string; name: string; graphJson: string; mapKind?: MapKind; updatedAt?: string };
  const { user } = useAuth();
  const userId = user?.id || 'anon';

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  
  // Restore workspaces for this user — persists now (fix menu déroulant vide)
  useEffect(() => {
    const saved = loadUserWorkspaces(userId);
    if (saved.workspaces.length > 0) {
      setWorkspaces(saved.workspaces);
      const active = saved.activeWorkspaceId && saved.workspaces.find(w => w.id === saved.activeWorkspaceId)
        ? saved.activeWorkspaceId
        : saved.workspaces[0].id;
      setActiveWorkspaceId(active);
      const target = saved.workspaces.find(w => w.id === active);
      if (target?.graphJson) {
        const ok = store.importJSON(target.graphJson);
        if (!ok) store.clearGraph();
      } else {
        store.clearGraph();
      }
      lastExportRef.current = target?.graphJson || store.exportJSON();
    } else {
      setWorkspaces([]);
      setActiveWorkspaceId('');
      store.clearGraph();
      lastExportRef.current = store.exportJSON();
    }
    setSelectedIds([]);
    setSelectedEdgeIds([]);
    setLinkBrowse(null);
    dirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  // Autosave: check if a file handle already exists (from a previous save)
  useEffect(() => {
    hasStoredHandle().then(setHasFileHandle);
  }, []);
  // Autosave every 3 min to the last picked file — only if a handle exists
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;
      const has = await hasStoredHandle();
      if (!has) { setHasFileHandle(false); return; }
      const res = await tryAutoSave(store.exportJSON());
      if (res === 'saved') {
        // mark as saved without adding history
        lastExportRef.current = store.exportJSON();
        dirtyRef.current = false;
        setHasFileHandle(true);
        setLastAutoSaveAt(Date.now());
        setAutoSaveHint(`✓ Autosauvegardé ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
        setTick((v) => v + 1);
        setTimeout(() => setAutoSaveHint(''), 3500);
      } else if (res === 'error') {
        setAutoSaveHint('Autosauvegarde échouée — le fichier a été déplacé ? Resauvegardez.');
        setTimeout(() => setAutoSaveHint(''), 5000);
      }
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [store]);


  useEffect(() => {
    // Every app launch: full hierarchy normalize + fix aberrations
    store.normalizeNow(true);  // force hierarchy scales on launch
    lastExportRef.current = store.exportJSON();
    const t = setTimeout(() => setBooted(true), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bridge web mindmap from AIPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ parentId: string; query: string; deep: boolean }>;
      const { parentId, query, deep } = ce.detail || ({} as any);
      if (!parentId) return;
      // @ts-ignore expandWithWebAI added via patch
      (store as any).expandWithWebAI?.(parentId, query || '', !!deep);
      setTimeout(() => {
        setSelectedIds([parentId]);
        setAiOpen(true);
      }, 80);
    };
    window.addEventListener('ku:web-mindmap' as any, handler);
    return () => window.removeEventListener('ku:web-mindmap' as any, handler as any);
  }, [store]);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = projectName?.trim() ? `${projectName.trim()} · Knowledge Universe` : 'Knowledge Universe';
  }, [projectName]);

  useEffect(() => {
    const snap = store.exportJSON();
    if (!lastExportRef.current) { lastExportRef.current = snap; dirtyRef.current = false; return; }
    const isDirty = snap !== lastExportRef.current;
    dirtyRef.current = isDirty;
    // trigger header re-render for dirty badge (lightweight)
    setTick((v) => v + 1);
    // Debounce heavy workspace graph serialization + localStorage persist
    // — avoids serializing + cloning on every mouse-move while dragging nodes
    if (workspaceSaveTimeoutRef.current) window.clearTimeout(workspaceSaveTimeoutRef.current);
    workspaceSaveTimeoutRef.current = window.setTimeout(() => {
      setWorkspaces((list) =>
        list.map((w) =>
          w.id === activeWorkspaceId
            ? {
                ...w,
                graphJson: snap,
                mapKind: (store.mapKind as MapKind) || w.mapKind,
                updatedAt: new Date().toISOString(),
              }
            : w
        )
      );
    }, 320);
    return () => {
      if (workspaceSaveTimeoutRef.current) window.clearTimeout(workspaceSaveTimeoutRef.current);
    };
  }, [graph, store, activeWorkspaceId]);

  // Persist workspaces to localStorage whenever they change (fix: menu déroulant bug)
  const prevWorkspacesKey = useRef('');
  useEffect(() => {
    if (!userId || userId === 'anon') return;
    const key = JSON.stringify({ workspaces, activeWorkspaceId });
    if (key === prevWorkspacesKey.current) return;
    prevWorkspacesKey.current = key;
    if (workspaces.length === 0 && !activeWorkspaceId) {
      // still save empty to clear stale? only after initial load
      // avoid wiping on first render before load completes
      return;
    }
    saveUserWorkspaces(userId, { workspaces, activeWorkspaceId });
  }, [workspaces, activeWorkspaceId, userId]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const alive = new Set(graph.nodes.map((n) => n.id));
    setSelectedIds((ids) => { const next = ids.filter((id) => alive.has(id)); return next.length === ids.length ? ids : next; });
    const edgeAlive = new Set(graph.edges.map((e) => e.id));
    setSelectedEdgeIds((ids) => { const next = ids.filter((id) => edgeAlive.has(id)); return next.length === ids.length ? ids : next; });
  }, [graph.nodes, graph.edges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoRef.current(); return; }

      if (e.key === 'Shift') shiftDown.current = true;
      if ((e.key === 'c' || e.key === 'C') && !inField) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setMultiSelectKind('concepts'); setMarqueeMode('concepts'); setSelectedEdgeIds([]);
        } else if (e.shiftKey) {
          e.preventDefault();
          setMultiSelectKind((k) => (k === 'concepts' ? null : 'concepts'));
          setMarqueeMode((m) => (m === 'concepts' ? null : 'concepts'));
          setSelectedEdgeIds([]);
        }
      }
      if ((e.key === 'l' || e.key === 'L') && !inField) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setMultiSelectKind('edges'); setMarqueeMode('edges'); setSelectedIds([]);
        } else if (e.shiftKey) {
          e.preventDefault();
          setMultiSelectKind((k) => (k === 'edges' ? null : 'edges'));
          setMarqueeMode((m) => (m === 'edges' ? null : 'edges'));
          setSelectedIds([]);
        }
      }
      if (e.key === 'Enter' && linkBrowse && !inField) {
        e.preventDefault();
        const L = linkBrowse.links[linkBrowse.focus];
        if (L) {
          const node = graph.nodes.find((n) => n.id === L.target.id);
          if (node) {
            setLinkBrowse(null);
            setSelectedIds([L.target.id]);
            setSelectedEdgeIds([]);
            setFlyToRequest({ id: L.target.id, zoom: zoomForNavigation(node.scale, viewport, camera.zoom), token: Date.now() });
          }
        }
        return;
      }
      if (e.key === 'Enter' && connectMode && !inField) {
        e.preventDefault(); setConnectMode(false); setConnectFrom(null); return;
      }
      if (e.key === 'Escape') {
        if (linkBrowse) { setLinkBrowse(null); return; }
        if (childPicker) { setChildPicker(null); return; }
        setConnectMode(false); setConnectFrom(null); setMultiSelectKind(null); setMarqueeMode(null);
        setAiOpen(false); setHelpOpen(false); setSelectedIds([]); setSelectedEdgeIds([]); setEditingProject(false);
      }
      if (inField) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) setHelpOpen((h) => !h);
      if (e.key === '+' || e.key === '=') setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom * 1.35) }));
      if (e.key === '-' || e.key === '_') setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom / 1.35) }));
      if ((e.key === 'c' || e.key === 'C') && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        setConnectMode((m) => !m); setConnectFrom(null); setMultiSelectKind(null);
      }
      if (e.key === 'n' || e.key === 'N') handleAddNodeRef.current?.();
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSelectedIds(graph.nodes.map((n) => n.id)); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeIds.length > 0) { e.preventDefault(); store.deleteEdges(selectedEdgeIds); setSelectedEdgeIds([]); return; }
        if (selectedIds.length > 0) { e.preventDefault(); setDeleteIds([...selectedIds]); }
      }
      if (
        (linkBrowse || !childPicker) &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        navigateByArrowRef.current?.(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftDown.current = false; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [graph.nodes, selectedIds, selectedEdgeIds, store, childPicker, connectMode, linkBrowse, viewport, camera.zoom]);

  const selectedNodes = useMemo(
    () => selectedIds.map((id) => graph.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n),
    [graph.nodes, selectedIds]
  );
  const primaryId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedNode = useMemo(() => (primaryId ? graph.nodes.find((n) => n.id === primaryId) ?? null : null), [graph.nodes, primaryId]);
  const breadcrumb = useMemo(() => (primaryId ? getBreadcrumb(primaryId, graph) : []), [primaryId, graph]);
  const breadcrumbPaths = useMemo(
    () => (primaryId ? getBreadcrumbAlternatives(primaryId, graph) : []),
    [primaryId, graph]
  );
  const {
    highlightedIds,
    highlightedEdgeIds,
    pathEdgeColors,
    pathNodeColors,
  } = useMemo(() => {
    const applyBrowse = (
      nodeIds: Set<string>,
      edgeIds: Set<string>,
      edgeColors: Map<string, string>
    ) => {
      if (!linkBrowse) return;
      const L = linkBrowse.links[linkBrowse.focus];
      if (!L) return;
      nodeIds.add(linkBrowse.fromId);
      nodeIds.add(L.target.id);
      edgeIds.add(L.edge.id);
      edgeColors.set(L.edge.id, '#22d3ee');
      // Also soft-highlight all browsable edges
      for (const l of linkBrowse.links) {
        edgeIds.add(l.edge.id);
        nodeIds.add(l.target.id);
        if (!edgeColors.has(l.edge.id)) edgeColors.set(l.edge.id, '#64748b');
      }
      edgeColors.set(L.edge.id, '#22d3ee');
    };

    if (selectedIds.length === 0 && !linkBrowse) {
      return {
        highlightedIds: new Set<string>(),
        highlightedEdgeIds: new Set<string>(),
        pathEdgeColors: undefined as Map<string, string> | undefined,
        pathNodeColors: undefined as Map<string, string[]> | undefined,
      };
    }
    if (selectedIds.length === 1 || linkBrowse) {
      const origin = linkBrowse?.fromId || selectedIds[0];
      const ctx = origin ? getSelectionContext(origin, graph) : {
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
        edgeColors: new Map<string, string>(),
        nodePathColors: new Map<string, string[]>(),
      };
      const nodeIds = new Set(ctx.nodeIds);
      const edgeIds = new Set(ctx.edgeIds);
      const edgeColors = new Map(ctx.edgeColors);
      applyBrowse(nodeIds, edgeIds, edgeColors);
      return {
        highlightedIds: nodeIds,
        highlightedEdgeIds: edgeIds,
        pathEdgeColors: edgeColors,
        pathNodeColors: ctx.nodePathColors,
      };
    }
    // Multi-select: merge all ascent paths
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const edgeColors = new Map<string, string>();
    const nodePathColors = new Map<string, string[]>();
    for (const id of selectedIds) {
      const ctx = getSelectionContext(id, graph);
      ctx.nodeIds.forEach((n) => nodeIds.add(n));
      ctx.edgeIds.forEach((e) => edgeIds.add(e));
      ctx.edgeColors.forEach((c, e) => {
        if (!edgeColors.has(e)) edgeColors.set(e, c);
      });
      ctx.nodePathColors.forEach((cols, n) => {
        const arr = nodePathColors.get(n) || [];
        for (const c of cols) if (!arr.includes(c)) arr.push(c);
        nodePathColors.set(n, arr);
      });
    }
    applyBrowse(nodeIds, edgeIds, edgeColors);
    return {
      highlightedIds: nodeIds,
      highlightedEdgeIds: edgeIds,
      pathEdgeColors: edgeColors,
      pathNodeColors: nodePathColors,
    };
  }, [selectedIds, graph, linkBrowse]);

  const isMindmap = mapKind === 'mindmap';
  const isTimeline = useMemo(
    () => isMindmap && isTimelineGraph(graph),
    [isMindmap, graph]
  );

  const selectedEdges = useMemo(
    () => selectedEdgeIds.map((id) => graph.edges.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e),
    [graph.edges, selectedEdgeIds]
  );

  const flyTo = useCallback((id: string, zoom?: number) => {
    setSelectedIds([id]);
    setLinkBrowse(null);
    const node = graph.nodes.find((n) => n.id === id);
    const z = zoom ?? (node ? zoomToFitNode(node.scale, viewport) : undefined);
    setFlyToRequest({ id, zoom: z, token: Date.now() });
  }, [graph.nodes, viewport]);

  const goToNode = useCallback((id: string) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    setSelectedIds([id]); setSelectedEdgeIds([]); setChildPicker(null); setLinkBrowse(null);
    // Navigation clavier / parcours : recentrage doux, peu de zoom
    setFlyToRequest({
      id,
      zoom: zoomForNavigation(node.scale, viewport, camera.zoom),
      token: Date.now(),
    });
  }, [graph.nodes, viewport, camera.zoom]);

  const buildBrowseLinks = useCallback((fromId: string): BrowseLink[] => {
    const cur = graph.nodes.find((n) => n.id === fromId);
    if (!cur) return [];
    const neigh = getNeighbors(fromId, graph);
    const links: BrowseLink[] = neigh.map(({ node, edge }) => {
      // Rôle hiérarchique : père = plus grand / parentId, fils = plus petit / enfant, sinon pair
      let role: BrowseLink['role'] = 'peer';
      if (cur.parentId === node.id || node.id === cur.parentId) {
        role = 'parent';
      } else if (node.parentId === cur.id) {
        role = 'child';
      } else if (node.scale > cur.scale * 1.08) {
        role = 'parent';
      } else if (node.scale < cur.scale * 0.92) {
        role = 'child';
      } else {
        // Types sémantiques
        const t = String(edge.type);
        if (t === 'parent' && edge.target === fromId) role = 'parent';
        else if (t === 'parent' && edge.source === fromId) role = 'child';
        else if (t === 'child' && edge.source === fromId) role = 'child';
        else if (t === 'child' && edge.target === fromId) role = 'parent';
      }
      return {
        edge,
        target: node,
        angle: Math.atan2(node.y - cur.y, node.x - cur.x),
        role,
      };
    });
    // Pères d'abord, puis pairs, puis fils ; dans chaque groupe, sens horaire
    const rank = (r: BrowseLink['role']) => (r === 'parent' ? 0 : r === 'peer' ? 1 : 2);
    links.sort((a, b) => {
      const rd = rank(a.role) - rank(b.role);
      if (rd !== 0) return rd;
      const na = ((a.angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
      const nb = ((b.angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
      return na - nb;
    });
    return links;
  }, [graph]);

  const navigateByArrow = useCallback((key: string) => {
    // No selection: pick nearest on screen, still don't jump via arrows alone
    const currentId =
      linkBrowse?.fromId ||
      (selectedIds.length === 1 ? selectedIds[0] : selectedIds[selectedIds.length - 1]);

    if (!currentId) {
      if (!graph.nodes.length) return;
      let best = graph.nodes[0];
      let bestD = Infinity;
      for (const n of graph.nodes) {
        const d = (n.x - camera.x) ** 2 + (n.y - camera.y) ** 2;
        if (d < bestD) { bestD = d; best = n; }
      }
      setSelectedIds([best.id]);
      setSelectedEdgeIds([]);
      const links = buildBrowseLinks(best.id);
      if (links.length) setLinkBrowse({ fromId: best.id, focus: 0, links });
      return;
    }

    const cur = graph.nodes.find((n) => n.id === currentId);
    if (!cur) return;

    let links = linkBrowse && linkBrowse.fromId === currentId
      ? linkBrowse.links
      : buildBrowseLinks(currentId);
    if (!links.length) return;

    // Direction as angle target
    let want = 0;
    if (key === 'ArrowRight') want = 0;
    else if (key === 'ArrowLeft') want = Math.PI;
    else if (key === 'ArrowDown') want = Math.PI / 2;
    else if (key === 'ArrowUp') want = -Math.PI / 2;

    let focus: number;
    if (linkBrowse && linkBrowse.fromId === currentId) {
      // Cycle around the ring
      const step = (key === 'ArrowRight' || key === 'ArrowDown') ? 1 : -1;
      focus = (linkBrowse.focus + step + links.length) % links.length;
    } else {
      // First arrow: pick link best aligned with direction
      let bestI = 0;
      let bestScore = -Infinity;
      links.forEach((l, i) => {
        const align = Math.cos(l.angle - want);
        if (align > bestScore) { bestScore = align; bestI = i; }
      });
      focus = bestI;
    }

    setChildPicker(null);
    setLinkBrowse({ fromId: currentId, focus, links });
    // Keep selection on origin; highlight handled via linkBrowse merge
    if (selectedIds.length !== 1 || selectedIds[0] !== currentId) {
      setSelectedIds([currentId]);
    }
    setSelectedEdgeIds([]);
  }, [selectedIds, graph, camera.x, camera.y, linkBrowse, buildBrowseLinks]);
  navigateByArrowRef.current = navigateByArrow;

  // Child picker: every linked neighbor (all edge types), not only parentId tree
  const pickerParent = childPicker
    ? graph.nodes.find((n) => n.id === childPicker.parentId) ?? null
    : null;
  const pickerChildren = childPicker
    ? getNeighbors(childPicker.parentId, graph)
        .map((n) => n.node)
        .slice()
        .sort((a, b) => {
          const p = pickerParent;
          if (!p) return 0;
          return Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x);
        })
    : [];

  const handleSelect = useCallback((id: string | null, opts?: { additive?: boolean }) => {
    if (id === null) {
      setSelectedIds([]);
      setLinkBrowse(null);
      if (!opts?.additive) setSelectedEdgeIds([]);
      return;
    }
    setLinkBrowse(null);
    // Ctrl additive keeps edge selection (concepts and/or links)
    if (!opts?.additive && multiSelectKind !== 'edges') setSelectedEdgeIds([]);
    if (opts?.additive || multiSelectKind === 'concepts') {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else setSelectedIds([id]);
  }, [multiSelectKind]);

  const handleMarqueeSelect = useCallback((ids: string[], additive: boolean) => {
    if (!additive) setSelectedEdgeIds([]);
    if (additive) setSelectedIds((prev) => { const s = new Set(prev); ids.forEach((id) => s.add(id)); return [...s]; });
    else setSelectedIds(ids);
  }, []);

  const handleMarqueeSelectEdges = useCallback((ids: string[], additive: boolean) => {
    if (!additive) setSelectedIds([]);
    if (additive) setSelectedEdgeIds((prev) => { const s = new Set(prev); ids.forEach((id) => s.add(id)); return [...s]; });
    else setSelectedEdgeIds(ids);
  }, []);

  const handleSelectEdge = useCallback((edgeId: string | null, opts?: { additive?: boolean }) => {
    if (edgeId === null) { setSelectedEdgeIds([]); return; }
    if (!opts?.additive && multiSelectKind !== 'concepts') setSelectedIds([]);
    if (opts?.additive || multiSelectKind === 'edges') {
      setSelectedEdgeIds((prev) =>
        prev.includes(edgeId) ? prev.filter((id) => id !== edgeId) : [...prev, edgeId]
      );
    } else setSelectedEdgeIds([edgeId]);
  }, [multiSelectKind]);

  const handleDoubleClick = useCallback((id: string) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return;
    flyTo(id, zoomToFitNode(node.scale * 0.6, viewport, 0.22));
  }, [graph.nodes, flyTo, viewport]);

  const handleConnectPick = useCallback((id: string) => {
    if (!connectFrom) { setConnectFrom(id); setSelectedIds([id]); return; }
    if (connectFrom === id) return;
    store.connect(connectFrom, id, connectType);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [connectFrom, connectType, store]);

  const handleAddNode = useCallback(() => {
    if (workspaces.length === 0) {
      setSeedFirstNode(true);
      setNewWsMode('empty-only');
      setNewWsOpen(true);
      return;
    }
    const anchor = selectedNodes[0];
    const near = anchor ? { x: anchor.x + 140 * anchor.scale, y: anchor.y } : { x: camera.x, y: camera.y };
    const node = store.addNode({ title: '', description: '' }, undefined, near);
    if (node) setSelectedIds([node.id]);
  }, [selectedNodes, camera, store, workspaces.length]);
  handleAddNodeRef.current = handleAddNode;

  const handleAddChronological = useCallback(() => {
    const step = buildChronologicalStep(graph);
    if (!step) {
      // fallback: create free node to the right of selection or camera
      const ref =
        selectedNodes[0] ||
        graph.nodes.slice().sort((a, b) => b.x - a.x)[0];
      const scale = ref?.scale ?? 1;
      const node = store.addNode(
        {
          title: '',
          description: 'Étape de frise',
          scale,
          scaleLocked: true,
          tags: ['chronologie', 'étape'],
          wFactor: ref?.wFactor ?? 1.25,
          hFactor: ref?.hFactor ?? 0.85,
          color: ref?.color,
        },
        undefined,
        { x: (ref?.x ?? camera.x) + 280, y: ref?.y ?? camera.y }
      );
      if (node) {
        if (ref) store.connect(ref.id, node.id, 'related', 'puis');
        setSelectedIds([node.id]);
      }
      return;
    }
    // Inject via load merge: addNode + connect
    const n = store.addNode(
      {
        title: step.node.title,
        description: step.node.description,
        scale: step.node.scale,
        scaleLocked: true,
        tags: step.node.tags,
        color: step.node.color,
        icon: step.node.icon,
        wFactor: step.node.wFactor,
        hFactor: step.node.hFactor,
      },
      undefined,
      { x: step.node.x, y: step.node.y }
    );
    if (!n) return;
    // Force position & scale (addNode may place elsewhere)
    store.moveNode(n.id, step.node.x, step.node.y);
    store.updateNode(n.id, {
      scale: step.node.scale,
      scaleLocked: true,
      tags: step.node.tags,
      wFactor: step.node.wFactor,
      hFactor: step.node.hFactor,
    });
    store.connect(step.edge.source, n.id, 'related', 'puis');
    setSelectedIds([n.id]);
    setCamera((c) => ({ ...c, x: step.node.x, y: step.node.y }));
  }, [graph, store, selectedNodes, camera.x, camera.y]);

  const handleAddChild = useCallback((parentId: string) => {
    const node = store.addNode({ title: '', description: '' }, parentId);
    if (!node) return;
    setSelectedIds([node.id]);
    setSelectedEdgeIds([]);
  }, [store]);

  const handleAddParent = useCallback((childId: string) => {
    const node = store.addParent(childId);
    if (!node) return;
    setSelectedIds([node.id]);
    setSelectedEdgeIds([]);
  }, [store]);

  const handleCanvasDoubleClick = useCallback((world: { x: number; y: number }) => {
    if (workspaces.length === 0) {
      setSeedFirstNode(true);
      setNewWsMode('empty-only');
      setNewWsOpen(true);
      return;
    }
    const node = store.addNode({ title: '', description: '' }, undefined, world);
    if (!node) return;
    store.moveNode(node.id, world.x, world.y);
    setSelectedIds([node.id]);
  }, [store, workspaces.length]);

  const handleInsertOnEdge = useCallback((edgeId: string) => {
    const node = store.insertOnEdge(edgeId);
    if (node) setSelectedIds([node.id]);
  }, [store]);

  const handleDeleteConfirm = useCallback((plan: DeletePlan) => {
    if (plan.mode === 'none') store.deleteNodes(plan.ids);
    else store.deleteWithBridges(plan.ids, plan.bridges);
    setSelectedIds((ids) => ids.filter((id) => !plan.ids.includes(id)));
    setDeleteIds(null);
  }, [store]);

  const exportBaseName = slugify(projectName || 'mon-univers');
  const markSaved = useCallback(() => { lastExportRef.current = store.exportJSON(); dirtyRef.current = false; }, [store]);

  const handleExportJSON = useCallback(async () => {
    try {
      const result = await saveTextFile(`${exportBaseName}.json`, store.exportJSON(), 'application/json');
      if (result === 'saved' || result === 'downloaded') { markSaved(); hasStoredHandle().then(setHasFileHandle); }
      if (result === 'saved') setHasFileHandle(true);
      if (result === 'cancelled') return;
    } catch (e) {
      console.error('[export]', e);
      // Fallback ultime : blob download direct si saveTextFile a throw
      try {
        const blob = new Blob([store.exportJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${exportBaseName}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 500);
        markSaved();
      } catch {}
    }
  }, [exportBaseName, store, markSaved]);

  const handleExportMD = useCallback(async () => {
    const result = await saveTextFile(`${exportBaseName}.md`, store.exportMarkdown(), 'text/markdown');
    if (result === 'saved' || result === 'downloaded') markSaved();
  }, [exportBaseName, store, markSaved]);

  const switchWorkspace = useCallback((wsId: string) => {
    if (wsId === activeWorkspaceId) return;
    const snapshot = store.exportJSON();
    setWorkspaces((list) =>
      list.map((w) =>
        w.id === activeWorkspaceId
          ? { ...w, graphJson: snapshot, mapKind: store.mapKind as MapKind }
          : w
      )
    );
    const target = workspaces.find((w) => w.id === wsId);
    if (target?.graphJson) store.importJSON(target.graphJson);
    else store.newGraph(target?.mapKind === 'mindmap' ? 'mindmap' : 'universe');
    setActiveWorkspaceId(wsId);
    setSelectedIds([]); setSelectedEdgeIds([]); setConnectMode(false); setConnectFrom(null);
    lastExportRef.current = target?.graphJson || store.exportJSON();
    dirtyRef.current = false;
  }, [activeWorkspaceId, workspaces, store]);

  const createWorkspace = useCallback(
    (choice: NewWorkspaceChoice) => {
      const { kind, label, template = 'empty', patternId } = choice;
      const snapshot = store.exportJSON();
      const id = `ws-${Date.now()}`;

      const pattern: MindmapPatternId | null =
        kind === 'mindmap'
          ? ((patternId ||
              (template !== 'empty' ? template : 'empty')) as MindmapPatternId)
          : null;

      const isGuide = pattern === 'feature-guide' || template === 'feature-guide';
      const isPattern =
        kind === 'mindmap' && pattern && pattern !== 'empty';

      const count = isGuide
        ? workspaces.filter((w) => w.name.startsWith('Guide')).length + 1
        : workspaces.filter(
            (w) =>
              (w.mapKind || 'universe') === kind &&
              w.name.startsWith(label)
          ).length + 1;

      const name = isGuide
        ? count > 1
          ? `Guide des fonctionnalités ${count}`
          : 'Guide des fonctionnalités'
        : isPattern && label
          ? count > 1
            ? `${label} ${count}`
            : label
          : `${label} ${count}`;

      let preset: GraphData | null = null;
      if (kind === 'mindmap' && pattern) {
        preset = createMindmapFromPattern(pattern);
      } else if (isGuide) {
        preset = createFeatureGuideMindmap();
      }

      const graphJson = preset ? serializeProject(preset) : '';

      setWorkspaces((list) => {
        const updated = list.map((w) =>
          w.id === activeWorkspaceId
            ? { ...w, graphJson: snapshot, mapKind: store.mapKind as MapKind }
            : w
        );
        return [
          ...updated,
          { id, name, graphJson, mapKind: kind as MapKind },
        ];
      });

      if (preset) {
        store.loadGraph(preset);
        store.setProjectName(preset.projectName || name);
      } else {
        store.newGraph(kind);
        store.setProjectName(name);
      }

      setActiveWorkspaceId(id);
      setSelectedIds([]);
      setSelectedEdgeIds([]);
      setLinkBrowse(null);
      setConnectMode(false);
      setConnectFrom(null);
      setCamera(INITIAL_CAMERA);

      const wantFirst = seedFirstNode && !preset;
      setSeedFirstNode(false);

      requestAnimationFrame(() => {
        if (preset && preset.nodes.length) {
          setCamera(fitCameraToNodes(preset.nodes as never, viewport, 0.12));
        }
        if (wantFirst) {
          const node = store.addNode({ title: '', description: '' });
          if (node) {
            setSelectedIds([node.id]);
            setCamera({ x: node.x, y: node.y, zoom: 1 });
          }
        }
        lastExportRef.current = store.exportJSON();
      });
      dirtyRef.current = false;
      setNewWsOpen(false);
    },
    [activeWorkspaceId, store, workspaces, viewport, seedFirstNode]
  );

  
  const openFeatureGuide = useCallback(() => {
    setSeedFirstNode(false);
    setNewWsMode('guide-only');
    // Direct open guide 2D (no extra modal step when explicit guide)
    createWorkspace({
      kind: 'mindmap',
      label: 'Guide des fonctionnalités',
      template: 'feature-guide',
    });
  }, [createWorkspace]);

  const openFirstConceptPicker = useCallback(() => {
    setSeedFirstNode(true);
    setNewWsMode('empty-only');
    setNewWsOpen(true);
  }, []);

  const openNewWorkspacePicker = useCallback(() => {
    setSeedFirstNode(false);
    setNewWsMode('all');
    setNewWsOpen(true);
  }, []);

  useEffect(() => {
    if (!depthToast) return;
    const t = setTimeout(() => setDepthToast(''), 4200);
    return () => clearTimeout(t);
  }, [depthToast]);

  // /app?guide=1 → guide 2D uniquement
  useEffect(() => {
    if (searchParams.get('guide') !== '1') return;
    openFeatureGuide();
    const next = new URLSearchParams(searchParams);
    next.delete('guide');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renameActiveWorkspace = useCallback(() => {
    const name = wsNameDraft.trim();
    if (!name) { setRenamingWs(false); return; }
    setWorkspaces((list) => list.map((w) => w.id === activeWorkspaceId ? { ...w, name } : w));
    setRenamingWs(false);
  }, [wsNameDraft, activeWorkspaceId]);

  const exportSelectedWorkspaces = useCallback(async (ids: string[]) => {
    try {
      const snapshot = store.exportJSON();
      const list = workspaces.map((w) => w.id === activeWorkspaceId ? { ...w, graphJson: snapshot } : w);
      setWorkspaces(list);
      const items = ids.map((id) => list.find((w) => w.id === id)).filter((w): w is NonNullable<typeof w> => !!w)
        .map((w) => {
          const g = w.id === activeWorkspaceId ? graph : parseProject(w.graphJson || '{"nodes":[],"edges":[]}') || { nodes: [], edges: [], projectName: w.name };
          return { id: w.id, name: w.name, graph: g as GraphData };
        });
      if (!items.length) return;
      const body = items.length === 1 ? serializeProject(items[0].graph) : serializeWorkspaceBundle(items);
      const name = items.length === 1 ? `${slugify(items[0].name)}.json` : 'espaces-knowledge-universe.json';
      const result = await saveTextFile(name, body, 'application/json');
      if (result === 'saved' || result === 'downloaded') { markSaved(); setExportWsOpen(false); hasStoredHandle().then(setHasFileHandle); }
      if (result === 'cancelled') return;
    } catch (e) {
      console.error('[export workspaces]', e);
      setExportWsOpen(false);
    }
  }, [workspaces, activeWorkspaceId, store, graph, markSaved]);

  // Fusion 2 JSON → 1 même espace (merge dans le workspace actif)
  const handleMergeFiles = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const incomingGraphs: GraphData[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const bundle = parseWorkspaceBundle(text);
        if (bundle && bundle.length) {
          for (const b of bundle) incomingGraphs.push(b.graph);
        } else {
          const g = parseProject(text);
          if (g) incomingGraphs.push(g);
          else console.warn('[merge] parse failed', file.name);
        }
      } catch (e) { console.warn('[merge] read failed', file.name, e); }
    }
    if (!incomingGraphs.length) { setMergeInfo('Aucun graphe valide trouvé.'); setTimeout(()=>setMergeInfo(''), 4000); return; }
    // Si aucun espace actif, on en crée un
    if (!activeWorkspaceId && workspaces.length === 0) {
      const first = incomingGraphs[0];
      const rest = incomingGraphs.slice(1);
      let merged = first;
      if (rest.length) merged = mergeMultipleGraphs(first, rest);
      store.loadGraph(merged);
      store.setProjectName(merged.projectName || 'Espace fusionné');
      const id = `ws-merged-${Date.now()}`;
      setWorkspaces([{ id, name: merged.projectName || 'Espace fusionné', graphJson: serializeProject(merged), mapKind: (merged.mapKind as MapKind) || 'universe' }]);
      setActiveWorkspaceId(id);
      lastExportRef.current = serializeProject(merged);
      setMergeInfo(`✓ Fusionné : ${merged.nodes.length} concepts · ${merged.edges.length} liens`);
      setTimeout(()=>setMergeInfo(''), 4000);
      setCamera(fitCameraToNodes(merged.nodes as never, viewport, 0.15));
      return;
    }
    // Merge dans l'espace actif existant
    const base = graph;
    const merged = mergeMultipleGraphs(base, incomingGraphs);
    store.loadGraph(merged as any);
    // Force le fit pour voir les 2 contenus
    requestAnimationFrame(()=> setCamera(fitCameraToNodes(merged.nodes as never, viewport, 0.15)));
    setMergeInfo(`✓ Fusionné : +${incomingGraphs.reduce((s,g)=>s+g.nodes.length,0)} concepts / +${incomingGraphs.reduce((s,g)=>s+g.edges.length,0)} liens → total ${merged.nodes.length} · ${merged.edges.length}`);
    setTimeout(()=>setMergeInfo(''), 5000);
  }, [graph, viewport, activeWorkspaceId, workspaces.length, store]);

  const resetView = useCallback(() => {
    if (!graph.nodes.length) { setCamera(INITIAL_CAMERA); setSelectedIds([]); return; }
    setCamera(fitCameraToNodes(graph.nodes, viewport));
  }, [graph.nodes, viewport]);

  const empty = graph.nodes.length === 0;
  const multi = selectedNodes.length > 1;
  const commitProjectName = () => { store.setProjectName(projectDraft.trim() || 'Mon univers'); setEditingProject(false); };

  return (
    <div className={`relative w-screen h-screen overflow-hidden bg-[#0a0a0f] text-white antialiased transition-opacity duration-700 ${booted ? 'opacity-100' : 'opacity-0'}`}
      style={{ fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif' }}>
      <InfiniteCanvas
        nodes={graph.nodes} edges={graph.edges} camera={camera} onCameraChange={setCamera}
        selectedIds={selectedIds} onSelect={handleSelect} onNodeDoubleClick={handleDoubleClick}
        onMoveNode={store.moveNode} onMoveNodes={store.moveNodes} onBeginNodeMove={store.beginMove}
        connectMode={connectMode} connectFrom={connectFrom} onConnectPick={handleConnectPick}
        highlightedIds={highlightedIds} highlightedEdgeIds={highlightedEdgeIds}
        pathEdgeColors={pathEdgeColors}
        flatScale={false}
        titleInside={isMindmap}
        flyToRequest={flyToRequest} onFlyToComplete={() => setFlyToRequest(null)}
        onCanvasDoubleClick={handleCanvasDoubleClick} onAddChild={handleAddChild}
        onInsertOnEdge={handleInsertOnEdge} selectedEdgeIds={selectedEdgeIds} onSelectEdge={handleSelectEdge}
        onMarqueeSelect={handleMarqueeSelect} onMarqueeSelectEdges={handleMarqueeSelectEdges}
        multiSelectKind={multiSelectKind} marqueeMode={marqueeMode} defaultLinkFontSize={defaultLinkFontSize}
        relationColors={relationColors} customRelationTypes={customRelationTypes} relationOverrides={relationOverrides}
      />

      {empty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto text-center max-w-lg px-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/15 border border-white/10 flex items-center justify-center mb-5">
              <Sparkles size={22} className="text-violet-300" />
            </div>
            <h1 className="text-xl font-semibold text-white/95 mb-2">Knowledge Universe</h1>
            <p className="text-sm text-white/40 mb-5">
              {workspaces.length === 0
                ? 'Aucun espace pour l’instant. Créez votre première carte ou ouvrez le guide.'
                : isMindmap
                  ? 'Mindmap vide. Ajoutez un concept (N) ou explorez le guide.'
                  : 'Univers vide. Ajoutez un concept (N) ou explorez le guide.'}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2.5 mb-4">
              <button type="button" onClick={openFirstConceptPicker} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/25 border border-violet-400/40 text-sm text-violet-100">
                <Plus size={16} /> Premier concept
              </button>
              <button
                type="button"
                onClick={openFeatureGuide}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-sm text-amber-100"
              >
                <BookOpen size={16} /> Guide (2D)
              </button>
            </div>
            <p className="text-[11px] text-white/30 leading-relaxed max-w-sm mx-auto">
              Aucun espace au départ. <span className="text-white/45">Premier concept</span> → choisir 2D ou 3D.
              Le <span className="text-amber-200/70">Guide</span> ouvre une mindmap 2D (2D → 3D → Concepts & Liens).
            </p>
          </div>
        </div>
      )}

      <header className="absolute top-0 inset-x-0 z-[70] pointer-events-none">
        <div className="flex items-start justify-between gap-3 sm:gap-4 p-3 sm:p-4 flex-wrap">
          <div className="pointer-events-auto flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-violet-300" />
              </div>
              <div className="min-w-0">
                {editingProject ? (
                  <input ref={projectInputRef} value={projectDraft} onChange={(e) => setProjectDraft(e.target.value)}
                    onBlur={commitProjectName}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitProjectName(); if (e.key === 'Escape') setEditingProject(false); }}
                    className="w-full max-w-[220px] bg-white/8 border border-violet-500/40 rounded-lg px-2 py-0.5 text-sm font-semibold text-white/95 outline-none" autoFocus />
                ) : (
                  <button type="button" onClick={() => { setProjectDraft(projectName || 'Mon univers'); setEditingProject(true); }}
                    className="text-sm font-semibold text-white/95 hover:text-violet-200 truncate max-w-[220px] text-left" title="Renommer le projet">
                    {projectName?.trim() || 'Mon univers'}
                  </button>
                )}
                <div className="text-[10px] text-white/30">
                  {multi
                    ? `${selectedIds.length} sélectionnés`
                    : workspaces.length === 0
                      ? 'Aucun espace'
                      : isMindmap
                        ? 'Mindmap 2D · taille stable après 3 niveaux'
                        : 'Univers 3D'}
                </div>
                {hasFileHandle && dirtyRef.current && tick >= 0 && <div className="text-[10px] text-amber-300/60">• modifications non enregistrées — autosauvegarde dans ~3 min</div>}
                {hasFileHandle && !dirtyRef.current && lastAutoSaveAt && <div className="text-[10px] text-emerald-300/50">Dernière autosauvegarde {new Date(lastAutoSaveAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
                {autoSaveHint && <div className="text-[10px] font-medium text-emerald-400/90 flex items-center gap-1"><Timer size={10}/> {autoSaveHint}</div>}
              </div>
            </div>
            <BreadcrumbNav items={breadcrumb} paths={breadcrumbPaths} onNavigate={flyTo} />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="relative hidden xl:flex items-center gap-2 p-1.5 pr-2 rounded-full border border-white/10 bg-[#12121a]/80 backdrop-blur-xl">
              <button onClick={() => setDefaultColorOpen((o) => !o)} className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <span className="w-6 h-6 rounded-full border border-white/15 shrink-0 flex items-center justify-center" style={{ background: defaultNodeColor ?? '#2a2a34' }}>
                  {!defaultNodeColor && <span className="text-[10px] text-white/40">A</span>}
                </span>
                <span className="text-xs font-medium text-white/80">{defaultNodeColor ? 'Couleur par défaut' : 'Auto (hérite)'}</span>
                <span className={`text-[10px] text-white/30 transition-transform ${defaultColorOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {defaultColorOpen && (
                <div className="absolute top-full left-0 mt-2 p-3 rounded-xl border border-white/10 bg-[#12121a] shadow-2xl flex flex-col gap-2.5 min-w-[280px] z-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Couleur par défaut</span>
                    <button onClick={() => { store.setDefaultNodeColor(null); }} className={`px-2 py-0.5 rounded-md text-[10px] border ${!defaultNodeColor ? 'bg-violet-500/20 border-violet-400/40 text-violet-200' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}>Auto</button>
                  </div>
                  <ColorPalette value={defaultNodeColor ?? undefined} customColors={customColors} onPick={(c) => store.setDefaultNodeColor(c)} onAddCustomColor={store.addCustomColor} onRemoveCustomColor={store.removeCustomColor} size="sm" />
                  {defaultNodeColor && <div className="text-[11px] text-white/30">Nouveaux concepts → <span className="inline-block w-2.5 h-2.5 rounded-full align-middle ml-1 border border-white/20" style={{ background: defaultNodeColor }} /> couleur fixée</div>}
                  {!defaultNodeColor && <div className="text-[11px] text-white/30">Sans défaut → hérite du parent</div>}
                </div>
              )}
              {defaultColorOpen && <button className="fixed inset-0 z-40" aria-label="Fermer" onClick={() => setDefaultColorOpen(false)} />}
            </div>
          </div>
          <div className="pointer-events-auto flex-1 flex justify-center pt-0.5 hidden sm:flex">
            <SearchBar
              nodes={graph.nodes}
              onSelect={(id) => flyTo(id)}
              connectMode={connectMode}
              connectFrom={connectFrom}
              connectFromTitle={connectFrom ? graph.nodes.find((n) => n.id === connectFrom)?.title : undefined}
              onConnectPick={handleConnectPick}
              edges={graph.edges}
            />
          </div>
          <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end max-w-[52vw]">
            {mergeInfo && <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-medium">{mergeInfo}</div>}
            <button onClick={()=> mergeFileRef.current?.click()} className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-[#12121a]/85 backdrop-blur text-xs text-white/70 hover:text-white hover:bg-white/10" title="Fusionner 2 JSON en 1 même espace (sélection multiple possible)"><GitMerge size={14} className="text-emerald-300"/> Fusionner JSON</button>
            <AccountMenu />
            <div className={`flex items-center gap-1 px-1.5 py-1 rounded-xl border bg-[#12121a]/85 backdrop-blur ${workspaces.length === 0 ? 'border-amber-500/30' : 'border-white/10'}`}>
              {workspaces.length === 0 ? (
                <span className="text-[11px] text-white/30 px-1.5">Aucun espace — clique +</span>
              ) : renamingWs ? (
                <input value={wsNameDraft} onChange={(e) => setWsNameDraft(e.target.value)} onBlur={renameActiveWorkspace}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameActiveWorkspace(); if (e.key === 'Escape') setRenamingWs(false); }}
                  autoFocus className="bg-white/10 border border-violet-500/40 rounded-md px-1.5 py-0.5 text-[11px] text-white/90 outline-none max-w-[130px]" />
              ) : (
                <select
                  value={activeWorkspaceId}
                  onChange={(e) => switchWorkspace(e.target.value)}
                  onDoubleClick={() => { const cur = workspaces.find((w) => w.id === activeWorkspaceId); setWsNameDraft(cur?.name || ''); setRenamingWs(true); }}
                  className="bg-transparent text-[11px] text-white/90 outline-none max-w-[140px] py-0.5 cursor-pointer"
                  title="Espace — double-clic pour renommer"
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#12121a] text-white">
                      {(w.mapKind === 'mindmap' ? '2D · ' : '3D · ') + w.name} {w.id === activeWorkspaceId ? '●' : ''}
                    </option>
                  ))}
                </select>
              )}
              {workspaces.length > 0 && !renamingWs && (
                <button type="button" onClick={() => { const cur = workspaces.find((w) => w.id === activeWorkspaceId); setWsNameDraft(cur?.name || ''); setRenamingWs(true); }}
                  className="px-1 py-0.5 rounded-md text-[10px] text-white/40 hover:text-white/70" title="Renommer">✎</button>
              )}
              <button type="button" onClick={openNewWorkspacePicker} className="px-1.5 py-0.5 rounded-md text-[11px] text-violet-200/80 hover:bg-violet-500/20 border border-transparent hover:border-violet-500/30" title="Nouvel espace (3D ou 2D)">+</button>
              {isTimeline && (
                <button
                  type="button"
                  onClick={handleAddChronological}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-amber-100 bg-amber-500/15 border border-amber-400/30 hover:bg-amber-500/25"
                  title="Ajouter un concept père sur la frise (même ligne, même taille)"
                >
                  <Timer size={12} /> Chronologiquement
                </button>
              )}
              {workspaces.length > 1 && (
                <button type="button" onClick={() => {
                  const cur = workspaces.find((w) => w.id === activeWorkspaceId);
                  if (!confirm(`Supprimer l'espace « ${cur?.name || ''} » ?`)) return;
                  const remaining = workspaces.filter((w) => w.id !== activeWorkspaceId);
                  const next = remaining[0];
                  setWorkspaces(remaining);
                  if (next) {
                    if (next.graphJson) store.importJSON(next.graphJson);
                    else store.newGraph(next.mapKind === 'mindmap' ? 'mindmap' : 'universe');
                    setActiveWorkspaceId(next.id);
                  }
                  setSelectedIds([]); setSelectedEdgeIds([]);
                }} className="px-1.5 py-0.5 rounded-md text-[11px] text-rose-300/80 hover:bg-rose-500/20" title="Supprimer">×</button>
              )}
            </div>
            <button onClick={() => setHelpOpen(true)} className="p-2 rounded-xl border border-white/10 bg-[#12121a]/80 text-white/40 hover:text-white/80" title="Aide">
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[70]">
        <Toolbar
          onZoomIn={() => setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom * 1.4) }))}
          onZoomOut={() => setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom / 1.4) }))}
          onResetView={resetView} onAddNode={handleAddNode}
          onToggleConnect={() => { setConnectMode((m) => !m); setConnectFrom(null); }}
          connectMode={connectMode} connectType={connectType} onConnectTypeChange={setConnectType}
          customRelationTypes={customRelationTypes} relationColors={relationColors} relationOverrides={relationOverrides}
          onToggleAI={() => setAiOpen((o) => !o)} aiOpen={aiOpen}
          onExportJSON={() => { void handleExportJSON(); }}
          onExportMD={() => { void handleExportMD(); }}
          onExportWorkspaces={() => setExportWsOpen(true)}
          onImport={() => fileRef.current?.click()}
          onMergeImport={() => mergeFileRef.current?.click()}
          onUndo={() => store.undo()}
          onClear={() => {
            if (!graph.nodes.length) return;
            if (confirm("Effacer tout l'univers ?")) { store.clearGraph(); setSelectedIds([]); setCamera(INITIAL_CAMERA); }
          }}
          stats={stats}
        />
      </div>

      {!empty && (
        <div className="absolute bottom-5 right-4 z-[70] flex flex-col items-end gap-2">
          <div className="flex flex-col items-end gap-1.5 mb-1">
            <div className="flex items-center gap-1">
              <LegendToggleBtn
                label="Liens"
                visible={showLinkLegend}
                onToggle={() => setShowLinkLegend((v) => !v)}
                activeClass="text-cyan-200"
              />
              <LegendToggleBtn
                label="Concepts"
                visible={showConceptLegend}
                onToggle={() => setShowConceptLegend((v) => !v)}
                activeClass="text-pink-200"
              />
            </div>
            {showLinkLegend && (
              <LinkLegend
                edges={graph.edges}
                relationColors={relationColors}
                customRelationTypes={customRelationTypes}
                relationOverrides={relationOverrides}
                usedTypes={new Set(graph.edges.map((e) => e.type as RelationType))}
                width={legendSize.width}
                height={legendSize.height}
                onResize={(w, h) => store.setLegendSize(w, h)}
              />
            )}
            {showConceptLegend && (
              <ConceptColorLegend
                nodes={graph.nodes}
                groupLabels={colorGroupLabels}
                onRenameGroup={store.setColorGroupLabel}
                width={conceptLegendSize.width}
                height={conceptLegendSize.height}
                onResize={(w, h) => store.setConceptLegendSize(w, h)}
              />
            )}
          </div>
          <Minimap
            nodes={graph.nodes}
            camera={camera}
            viewport={viewport}
            onNavigate={(x, y) => setCamera((c) => ({ ...c, x, y }))}
            selectedId={primaryId}
          />
        </div>
      )}

      {primaryId && breadcrumbPaths.length > 1 && !connectMode && (
        <div className="absolute top-[4.75rem] left-4 z-[80] pointer-events-none">
          <div className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[10px] text-white/50">
            {breadcrumbPaths.length} chemins illuminés vers les racines
          </div>
        </div>
      )}
      {connectMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[85] px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/40 backdrop-blur text-xs text-violet-200 shadow-lg">
          {connectFrom ? `Source fixée — plusieurs cibles · Entrée pour valider` : 'Source puis plusieurs cibles · Entrée pour valider'}
        </div>
      )}
      {multiSelectKind === 'concepts' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[85] px-4 py-2 rounded-full bg-amber-500/20 border border-amber-400/40 text-xs text-amber-100">Mode concepts — clic ou rectangle · Échap</div>
      )}
      {multiSelectKind === 'edges' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[85] px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-xs text-cyan-100">Mode liens — clic ou rectangle · Échap</div>
      )}

      {pickerParent && pickerChildren.length > 0 && childPicker && !linkBrowse && (
        <ChildPicker parent={pickerParent} children={pickerChildren} focusIndex={childPicker.focus}
          onFocusChange={(i) => setChildPicker((p) => (p ? { ...p, focus: i } : p))}
          onPick={(id) => goToNode(id)} onCancel={() => setChildPicker(null)} />
      )}

      {linkBrowse && (() => {
        const from = graph.nodes.find((n) => n.id === linkBrowse.fromId);
        if (!from) return null;
        return (
          <LinkBrowsePreview
            from={from}
            links={linkBrowse.links}
            focusIndex={linkBrowse.focus}
            onFocusChange={(i) => setLinkBrowse((b) => (b ? { ...b, focus: i } : b))}
            onConfirm={(id) => goToNode(id)}
            onCancel={() => setLinkBrowse(null)}
            relationColors={relationColors}
            customRelationTypes={customRelationTypes}
          />
        );
      })()}

      {selectedEdges.length > 0 && (
        <div className={`absolute top-16 z-[80] ${multi || selectedNode ? 'left-4' : 'right-4'}`}>
          <EdgePanel edges={selectedEdges} graph={graph} onClose={() => setSelectedEdgeIds([])}
            onUpdate={store.updateEdge} onUpdateMany={store.updateEdges}
            onDelete={(ids) => { store.deleteEdges(ids); setSelectedEdgeIds([]); }}
            onNavigate={(id) => setSelectedIds([id])}
            relationColors={relationColors} customRelationTypes={customRelationTypes}
            onSetRelationColor={store.setRelationColor} onResetRelationColor={store.resetRelationColor}
            onAddRelationType={store.addRelationType} onRemoveRelationType={store.removeRelationType}
            onPatchRelationType={store.patchRelationType} relationOverrides={relationOverrides}
            defaultLinkFontSize={defaultLinkFontSize} onSetDefaultLinkFontSize={store.setDefaultLinkFontSize} />
        </div>
      )}

      {multi ? (
        <BulkEditPanel nodes={selectedNodes} allNodes={graph.nodes} customColors={customColors}
          onClose={() => setSelectedIds([])} onApply={(ids, patch) => store.updateNodes(ids, patch)}
          onScaleFactor={(ids, factor) => store.scaleNodesByFactor(ids, factor)}
          onApplyScalePercent={(ids, pct) => {
            const byId = new Map(graph.nodes.map((n) => [n.id, n]));
            ids.forEach((id) => {
              const n = byId.get(id); if (!n) return;
              const parent = n.parentId ? byId.get(n.parentId) : undefined;
              store.updateNode(id, { scale: (parent?.scale ?? 1) * (pct / 100) });
            });
          }}
          onRequestDelete={(ids) => setDeleteIds(ids)}
          onAddCustomColor={store.addCustomColor} onRemoveCustomColor={store.removeCustomColor}
          onNavigate={(id) => setSelectedIds([id])} />
      ) : (
        <SidePanel node={selectedNode} graph={graph} customColors={customColors}
          onClose={() => setSelectedIds([])} onUpdate={store.updateNode}
          onDelete={(id) => { store.deleteNode(id); setSelectedIds([]); }}
          onAddChild={handleAddChild} onAddParent={handleAddParent} onExpandAI={(id) => store.expandWithAI(id)}
          onNavigate={flyTo} onDeleteEdge={(id) => { store.deleteEdge(id); setSelectedEdgeIds((p) => p.filter((x) => x !== id)); }}
          onUpdateEdge={store.updateEdge} onConnect={store.connect}
          onStartConnect={(fromId) => { setConnectMode(true); setConnectFrom(fromId); setSelectedIds([fromId]); }}
          onAddCustomColor={store.addCustomColor} onRemoveCustomColor={store.removeCustomColor}
          onRequestDelete={(ids) => setDeleteIds(ids)} favoriteIcons={favoriteIcons}
          onToggleFavoriteIcon={store.toggleFavoriteIcon} onSelectEdge={(edgeId) => setSelectedEdgeIds([edgeId])}
          relationColors={relationColors} customRelationTypes={customRelationTypes} />
      )}

      {deleteIds && deleteIds.length > 0 && (
        <DeleteReconnectDialog nodeIds={deleteIds} graph={graph} onCancel={() => setDeleteIds(null)} onConfirm={handleDeleteConfirm} />
      )}

      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} graph={graph} contextNode={selectedNode} onExpandAI={store.expandWithAI} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const text = await file.text();
          const bundle = parseWorkspaceBundle(text);
          if (bundle && bundle.length > 1) {
            const snapshot = store.exportJSON();
            setWorkspaces((list) => {
              const updated = list.map((w) => w.id === activeWorkspaceId ? { ...w, graphJson: snapshot } : w);
              const imported = bundle.map((b, i) => ({
                id: b.id || `ws-imp-${Date.now()}-${i}`,
                name: b.name,
                graphJson: serializeProject(b.graph),
                mapKind: (b.graph.mapKind === 'mindmap' ? 'mindmap' : 'universe') as MapKind,
              }));
              return [...updated, ...imported];
            });
            store.loadGraph(bundle[0].graph);
            setActiveWorkspaceId(bundle[0].id || `ws-imp-${Date.now()}-0`);
            setSelectedIds([]); setSelectedEdgeIds([]);
            lastExportRef.current = serializeProject(bundle[0].graph);
            dirtyRef.current = false;
          } else if (store.importJSON(text)) {
            setSelectedIds([]); setSelectedEdgeIds([]);
            lastExportRef.current = text; dirtyRef.current = false;
          }
          e.target.value = '';
        }} />
      <input ref={mergeFileRef} type="file" accept="application/json,.json" multiple className="hidden"
        onChange={async (e) => { await handleMergeFiles(e.target.files); e.target.value=''; }} />

      <ExportWorkspacesModal open={exportWsOpen} workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        activeId={activeWorkspaceId} onClose={() => setExportWsOpen(false)}
        onExport={(ids) => { void exportSelectedWorkspaces(ids); }} />

      <NewWorkspaceModal
        open={newWsOpen}
        onClose={() => { setNewWsOpen(false); setSeedFirstNode(false); }}
        onCreate={createWorkspace}
        mode={newWsMode}
      />

      {depthToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-full bg-amber-500/20 border border-amber-400/40 text-xs text-amber-50 shadow-lg flex items-center gap-3">
          <span>{depthToast}</span>
          <button type="button" className="text-amber-100/60" onClick={() => setDepthToast('')}>✕</button>
        </div>
      )}

      {booted && !empty && selectedIds.length === 0 && !connectMode && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <p className="text-xs text-white/25 tracking-wide">Ctrl+clic multi concepts/liens · Shift/Ctrl+C|L · Entrée liens · ±10% taille concept</p>
        </div>
      )}
    </div>
  );
}
