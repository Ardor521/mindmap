
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Camera, KnowledgeEdge, KnowledgeNode, RelationType, RelationTypeDef, ViewportSize } from '../lib/types';
import { getRelationMeta } from '../lib/types';
import {
  clampZoom, createFlyTo, formatZoom, getVisibleBounds, screenToWorld, tickAnimation, worldToScreen,
  type CameraAnimation,
} from '../lib/camera';
import { NodeCard } from './NodeCard';

interface Props {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  camera: Camera;
  onCameraChange: (c: Camera) => void;
  selectedIds: string[];
  onSelect: (id: string | null, opts?: { additive?: boolean }) => void;
  onNodeDoubleClick: (id: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onMoveNodes?: (moves: { id: string; x: number; y: number }[]) => void;
  connectMode: boolean;
  connectFrom: string | null;
  onConnectPick: (id: string) => void;
  highlightedIds: Set<string>;
  highlightedEdgeIds?: Set<string>;
  /** Per-edge highlight color for multi-path ascent */
  pathEdgeColors?: Map<string, string>;
  /** Temporary layout overrides — does not mutate store */
  layoutOverrides?: Map<string, { x: number; y: number; scale: number }>;
  /** When true, node screen size ignores deep scale extremes (mindmap) */
  flatScale?: boolean;
  /** Mindmap 2D: title rendered inside the block */
  titleInside?: boolean;
  flyToRequest: { id: string; zoom?: number; token: number } | null;
  onFlyToComplete?: () => void;
  onCanvasDoubleClick?: (world: { x: number; y: number }) => void;
  onAddChild?: (parentId: string) => void;
  onBeginNodeMove?: () => void;
  onInsertOnEdge?: (edgeId: string) => void;
  selectedEdgeIds?: string[];
  onSelectEdge?: (edgeId: string | null, opts?: { additive?: boolean }) => void;
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
  multiSelectKind?: 'concepts' | 'edges' | null;
  marqueeMode?: 'concepts' | 'edges' | 'both' | null;
  onMarqueeSelectEdges?: (ids: string[], additive: boolean) => void;
  defaultLinkFontSize?: number;
  relationColors?: Partial<Record<string, string>>;
  customRelationTypes?: RelationTypeDef[];
  relationOverrides?: Partial<Record<string, { label?: string; color?: string; style?: string; dashed?: boolean; fontSize?: number }>>;
}

export function InfiniteCanvas({
  nodes, edges, camera, onCameraChange, selectedIds, onSelect, onNodeDoubleClick,
  onMoveNode, onMoveNodes, connectMode, connectFrom, onConnectPick, highlightedIds,
  highlightedEdgeIds, pathEdgeColors, layoutOverrides, flatScale = false, titleInside = false,
  flyToRequest, onFlyToComplete, onCanvasDoubleClick, onAddChild,
  onBeginNodeMove, onInsertOnEdge, selectedEdgeIds = [], onSelectEdge, onMarqueeSelect,
  multiSelectKind = null, marqueeMode = null, onMarqueeSelectEdges, defaultLinkFontSize = 12,
  relationColors, customRelationTypes, relationOverrides,
}: Props) {
  const isLargeGraph = nodes.length > 120;
  const isVeryLarge = nodes.length > 220;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const layoutOverridesRef = useRef(layoutOverrides);
  layoutOverridesRef.current = layoutOverrides;
  const flatScaleRef = useRef(flatScale);
  flatScaleRef.current = flatScale;
  const multiSelectKindRef = useRef(multiSelectKind);
  multiSelectKindRef.current = multiSelectKind;
  const marqueeModeRef = useRef(marqueeMode);
  marqueeModeRef.current = marqueeMode;
  const defaultLinkFontSizeRef = useRef(defaultLinkFontSize);
  defaultLinkFontSizeRef.current = defaultLinkFontSize;
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 1200, height: 800 });
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);
  const onCameraChangeRef = useRef(onCameraChange);
  const animRef = useRef<CameraAnimation | null>(null);
  const rafRef = useRef<number>(0);
  const spaceDown = useRef(false);
  const onFlyToCompleteRef = useRef(onFlyToComplete);
  onFlyToCompleteRef.current = onFlyToComplete;
  const lastFlyTokenRef = useRef<number | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const dragRef = useRef<{
    kind: 'pan' | 'node' | 'marquee' | null;
    pointerId: number; startX: number; startY: number;
    originCamX: number; originCamY: number;
    nodeId?: string; origins?: Map<string, { x: number; y: number }>;
    moved: boolean; additive?: boolean; startLocalX?: number; startLocalY?: number;
  } | null>(null);

  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setViewport({ width: r.width, height: r.height });
    });
    ro.observe(el);
    setViewport({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (animRef.current) { animRef.current = null; onFlyToCompleteRef.current?.(); }
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const cam = cameraRef.current, vp = viewportRef.current;
      const nextZoom = clampZoom(cam.zoom * Math.exp(-e.deltaY * 0.0018));
      const worldBefore = screenToWorld(sx, sy, cam, vp);
      const next: Camera = {
        zoom: nextZoom,
        x: worldBefore.x - (sx - vp.width / 2) / nextZoom,
        y: worldBefore.y - (sy - vp.height / 2) / nextZoom,
      };
      if (e.shiftKey && Math.abs(e.deltaX) < 1) {
        next.x = cam.x + e.deltaY / cam.zoom; next.y = cam.y; next.zoom = cam.zoom;
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        next.x = cam.x + e.deltaX / cam.zoom; next.y = cam.y + e.deltaY / cam.zoom; next.zoom = cam.zoom;
      }
      cameraRef.current = next;
      onCameraChangeRef.current(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startAnimLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const loop = (now: number) => {
      if (!animRef.current) return;
      const { camera: c, done } = tickAnimation(animRef.current, now);
      cameraRef.current = c;
      onCameraChangeRef.current(c);
      if (done) {
        const complete = animRef.current.onComplete;
        animRef.current = null;
        complete?.();
        onFlyToCompleteRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (!flyToRequest) return;
    if (lastFlyTokenRef.current === flyToRequest.token) return;
    lastFlyTokenRef.current = flyToRequest.token;
    const raw = nodesRef.current.find((n) => n.id === flyToRequest.id);
    const ovr = layoutOverridesRef.current?.get(flyToRequest.id);
    const node = raw
      ? ovr
        ? { ...raw, x: ovr.x, y: ovr.y, scale: ovr.scale }
        : raw
      : null;
    if (!node) { onFlyToCompleteRef.current?.(); return; }
    const targetZoom = flyToRequest.zoom ?? clampZoom(
      Math.min(viewportRef.current.height * 0.28, viewportRef.current.width * 0.28) / (104 * node.scale)
    );
    animRef.current = createFlyTo(cameraRef.current, node.x, node.y, targetZoom, 700);
    startAnimLoop();
  }, [flyToRequest, startAnimLoop]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-action]') || target.closest('[data-edge-action]')) return;
    const nodeEl = target.closest('[data-node-id]') as HTMLElement | null;

    if (nodeEl && e.button === 1) {
      e.preventDefault();
      if (multiSelectKindRef.current === 'edges') return;
      onSelect(nodeEl.dataset.nodeId!, { additive: true });
      return;
    }

    if (nodeEl && e.button === 0 && !spaceDown.current) {
      const id = nodeEl.dataset.nodeId!;
      if (connectMode) { onConnectPick(id); return; }
      // Ctrl/Cmd+click can multi-select concepts even in edges mode (toggle)
      const ctrlAdd = e.ctrlKey || e.metaKey;
      if (multiSelectKindRef.current === 'edges' && !ctrlAdd) return;
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const additive =
        ctrlAdd || multiSelectKindRef.current === 'concepts';
      const alreadyInSelection = selectedIdsRef.current.includes(id);
      if (additive) onSelect(id, { additive: true });
      else if (!alreadyInSelection) onSelect(id, { additive: false });

      // Free drag in 2D and 3D (positions always stored on nodes)
      // Don't start drag when Ctrl-toggling multi-select
      if (ctrlAdd) return;

      const idsForDrag = alreadyInSelection && !additive ? selectedIdsRef.current
        : additive ? (selectedIdsRef.current.includes(id) ? selectedIdsRef.current.filter((x) => x !== id) : [...selectedIdsRef.current, id])
        : [id];
      const dragIds = idsForDrag.length ? idsForDrag : [id];
      const origins = new Map<string, { x: number; y: number }>();
      for (const nid of dragIds) {
        const n = nodes.find((x) => x.id === nid);
        if (n) origins.set(nid, { x: n.x, y: n.y });
      }
      if (!origins.has(id)) origins.set(id, { x: node.x, y: node.y });
      if (animRef.current) { animRef.current = null; onFlyToCompleteRef.current?.(); }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onBeginNodeMove?.();
      dragRef.current = {
        kind: 'node', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        originCamX: cameraRef.current.x, originCamY: cameraRef.current.y,
        nodeId: id, origins, moved: false,
      };
      return;
    }

    if (!nodeEl) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      animRef.current = null;
      const rect = containerRef.current?.getBoundingClientRect();
      const lx = rect ? e.clientX - rect.left : e.clientX;
      const ly = rect ? e.clientY - rect.top : e.clientY;
      const wantMarquee = e.button === 0 && !spaceDown.current && (
        e.shiftKey || e.altKey || multiSelectKindRef.current === 'concepts' || multiSelectKindRef.current === 'edges' || marqueeModeRef.current != null
      );
      if (animRef.current) { animRef.current = null; onFlyToCompleteRef.current?.(); }
      if (wantMarquee) {
        dragRef.current = {
          kind: 'marquee', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
          originCamX: cameraRef.current.x, originCamY: cameraRef.current.y, moved: false,
          additive: e.metaKey || e.ctrlKey || multiSelectKindRef.current != null,
          startLocalX: lx, startLocalY: ly,
        };
        setMarquee({ x0: lx, y0: ly, x1: lx, y1: ly });
        if (!e.metaKey && !e.ctrlKey && !multiSelectKindRef.current) {
          onSelect(null); onSelectEdge?.(null);
        }
        return;
      }
      if (e.button === 0 || e.button === 1 || spaceDown.current) {
        dragRef.current = {
          kind: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
          originCamX: cameraRef.current.x, originCamY: cameraRef.current.y, moved: false,
        };
      }
    }
  }, [connectMode, nodes, onConnectPick, onSelect, onBeginNodeMove, onSelectEdge]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setCursorWorld(screenToWorld(e.clientX - rect.left, e.clientY - rect.top, cameraRef.current, viewportRef.current));
    }
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.kind === 'marquee') {
      const r = containerRef.current?.getBoundingClientRect();
      setMarquee({ x0: d.startLocalX ?? 0, y0: d.startLocalY ?? 0, x1: r ? e.clientX - r.left : e.clientX, y1: r ? e.clientY - r.top : e.clientY });
    } else if (d.kind === 'pan') {
      const cam = cameraRef.current;
      const next = { ...cam, x: d.originCamX - dx / cam.zoom, y: d.originCamY - dy / cam.zoom };
      cameraRef.current = next; onCameraChange(next);
    } else if (d.kind === 'node' && d.origins) {
      const cam = cameraRef.current;
      const wdx = dx / cam.zoom, wdy = dy / cam.zoom;
      const moves: { id: string; x: number; y: number }[] = [];
      d.origins.forEach((origin, id) => moves.push({ id, x: origin.x + wdx, y: origin.y + wdy }));
      if (moves.length > 1 && onMoveNodes) onMoveNodes(moves);
      else if (moves.length === 1) onMoveNode(moves[0].id, moves[0].x, moves[0].y);
    }
  }, [onCameraChange, onMoveNode, onMoveNodes]);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.kind === 'marquee') {
      const rect = containerRef.current?.getBoundingClientRect();
      const lx = rect ? e.clientX - rect.left : e.clientX;
      const ly = rect ? e.clientY - rect.top : e.clientY;
      const x0 = Math.min(d.startLocalX ?? 0, lx), y0 = Math.min(d.startLocalY ?? 0, ly);
      const x1 = Math.max(d.startLocalX ?? 0, lx), y1 = Math.max(d.startLocalY ?? 0, ly);
      const cam = cameraRef.current, vp = viewportRef.current;
      const mode = marqueeModeRef.current || multiSelectKindRef.current || 'concepts';
      if (Math.abs(x1 - x0) > 4 || Math.abs(y1 - y0) > 4) {
        const resolvePos = (n: { id: string; x: number; y: number }) => {
          const o = layoutOverridesRef.current?.get(n.id);
          return o ? { x: o.x, y: o.y } : { x: n.x, y: n.y };
        };
        if (mode === 'concepts' || mode === 'both') {
          const picked: string[] = [];
          for (const n of nodesRef.current) {
            const p = resolvePos(n);
            const s = worldToScreen(p.x, p.y, cam, vp);
            if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) picked.push(n.id);
          }
          onMarqueeSelect?.(picked, !!d.additive);
        }
        if (mode === 'edges' || mode === 'both') {
          const edgeIds: string[] = [];
          const nmap = new Map(nodesRef.current.map((n) => [n.id, n]));
          for (const edge of edges) {
            const a = nmap.get(edge.source), b = nmap.get(edge.target);
            if (!a || !b) continue;
            const pa = resolvePos(a), pb = resolvePos(b);
            const sa = worldToScreen(pa.x, pa.y, cam, vp), sb = worldToScreen(pb.x, pb.y, cam, vp);
            const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2;
            if ((sa.x >= x0 && sa.x <= x1 && sa.y >= y0 && sa.y <= y1) ||
                (sb.x >= x0 && sb.x <= x1 && sb.y >= y0 && sb.y <= y1) ||
                (mx >= x0 && mx <= x1 && my >= y0 && my <= y1)) edgeIds.push(edge.id);
          }
          onMarqueeSelectEdges?.(edgeIds, !!d.additive);
        }
      }
      setMarquee(null);
    } else if (d.kind === 'pan' && !d.moved && e.button === 0) {
      onSelect(null); onSelectEdge?.(null);
    }
    dragRef.current = null;
  }, [onMarqueeSelect, onMarqueeSelectEdges, onSelect, onSelectEdge, edges]);

  const bounds = useMemo(() => getVisibleBounds(camera, viewport, 400), [camera, viewport]);
  /** Display positions/scales (mindmap overrides or universe originals) */
  const displayNodes = useMemo(() => {
    if (!layoutOverrides || layoutOverrides.size === 0) return nodes;
    return nodes.map((n) => {
      const o = layoutOverrides.get(n.id);
      if (!o) return n;
      return { ...n, x: o.x, y: o.y, scale: o.scale };
    });
  }, [nodes, layoutOverrides]);

  const nodeMap = useMemo(() => new Map(displayNodes.map((n) => [n.id, n])), [displayNodes]);

  const visibleNodes = useMemo(() => displayNodes.filter((n) => {
    // Same visibility rules in 2D and 3D (real hierarchical scales)
    const scale = n.scale;
    const wF = n.wFactor ?? 1;
    const hF = n.hFactor ?? 1;
    const screenR = 104 * scale * Math.max(wF, hF) * camera.zoom;
    // Mode perf : quand la carte est très remplie, on cache les toutes petites pastilles non sélectionnées
    if (isVeryLarge) {
      if (screenR < 5 && !selectedSet.has(n.id) && !highlightedIds.has(n.id)) return false;
    } else if (isLargeGraph) {
      if (screenR < 3.5 && !selectedSet.has(n.id) && !highlightedIds.has(n.id)) return false;
    } else {
      if (screenR < 2 && !selectedSet.has(n.id) && !highlightedIds.has(n.id)) return false;
    }
    if (screenR > Math.max(viewport.width, viewport.height) * 3.5) return false;
    const pad = Math.max(screenR, 40);
    return n.x >= bounds.minX - pad / camera.zoom && n.x <= bounds.maxX + pad / camera.zoom &&
      n.y >= bounds.minY - pad / camera.zoom && n.y <= bounds.maxY + pad / camera.zoom;
  }), [displayNodes, bounds, camera.zoom, selectedSet, highlightedIds, viewport, isLargeGraph, isVeryLarge]);
  const visibleIdSet = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => edges.filter((e) => {
    const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
    if (!a || !b) return false;
    // En mode très dense : on ne dessine que les liens dont au moins une extrémité est visible ET pas trop petite
    if (isVeryLarge && !visibleIdSet.has(e.source) && !visibleIdSet.has(e.target)) return false;
    if (!visibleIdSet.has(e.source) && !visibleIdSet.has(e.target)) {
      // hors écran : on garde seulement les liens highlightés
      if (!selectedSet.has(a.id) && !selectedSet.has(b.id) && !highlightedIds.has(a.id) && !highlightedIds.has(b.id)) return false;
    }
    const avgScale = (a.scale + b.scale) / 2;
    const edgePx = 104 * avgScale * camera.zoom;
    if (isLargeGraph) {
      if (edgePx < 2.5 && !selectedSet.has(a.id) && !selectedSet.has(b.id) && !highlightedIds.has(a.id)) return false;
    } else {
      if (edgePx < 1.5 && !selectedSet.has(a.id) && !selectedSet.has(b.id)) return false;
    }
    return visibleIdSet.has(e.source) || visibleIdSet.has(e.target);
  }), [edges, nodeMap, visibleIdSet, camera.zoom, selectedSet, highlightedIds, isLargeGraph, isVeryLarge]);

  const gridLayers = useMemo(() => {
    if (isLargeGraph) return []; // désactive la grille quand la carte est dense — gros gain perf (moins de layers + moins de repaint)
    const layers: { size: number; opacity: number }[] = [];
    const base = Math.pow(10, Math.floor(Math.log10(70 / camera.zoom)));
    for (const mult of [0.1, 1, 10]) {
      const size = base * mult;
      const screen = size * camera.zoom;
      if (screen < 18 || screen > 220) continue;
      layers.push({ size, opacity: Math.min(0.16, (screen / 120) * 0.12) });
    }
    return layers;
  }, [camera.zoom, isLargeGraph]);
  const originScreen = worldToScreen(0, 0, camera, viewport);

  return (
    <div ref={containerRef}
      className={`absolute inset-0 overflow-hidden touch-none select-none ${connectMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={(e) => {
        const t = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null;
        if (t?.dataset.nodeId) { onNodeDoubleClick(t.dataset.nodeId); return; }
        if (onCanvasDoubleClick && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          onCanvasDoubleClick(screenToWorld(e.clientX - rect.left, e.clientY - rect.top, cameraRef.current, viewportRef.current));
        }
      }}>
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.12), transparent 60%),
          radial-gradient(ellipse 50% 40% at 20% 80%, rgba(236,72,153,0.08), transparent 50%),
          radial-gradient(ellipse 40% 50% at 80% 20%, rgba(6,182,212,0.08), transparent 50%)`,
      }} />
      {gridLayers.map((layer) => {
        const screen = layer.size * camera.zoom;
        return (
          <div key={layer.size} className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,${layer.opacity}) 1px, transparent 1px)`,
            backgroundSize: `${screen}px ${screen}px`,
            backgroundPosition: `${originScreen.x % screen}px ${originScreen.y % screen}px`,
          }} />
        );
      })}

      <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
        {visibleEdges.map((e) => {
          const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
          if (!a || !b) return null;
          const sa0 = worldToScreen(a.x, a.y, camera, viewport);
          const sb0 = worldToScreen(b.x, b.y, camera, viewport);
          const meta = getRelationMeta(e.type, relationColors, customRelationTypes, relationOverrides as never);
          const isPathEdge = highlightedEdgeIds?.has(e.id) ?? false;
          const isEdgeHover = hoveredEdgeId === e.id;
          const isEdgeSelected = selectedEdgeIds.includes(e.id);
          const isHi = isPathEdge || isEdgeSelected;
          const isDim = (selectedIds.length > 0 || (highlightedEdgeIds && highlightedEdgeIds.size > 0)) && !isHi && !isEdgeHover;
          const pathCol = pathEdgeColors?.get(e.id);
          const edgeColor = pathCol || e.color || meta.color;
          // Respect stored style (tirets fins stay visible as dotted; hierarchy ignores them)
          const edgeStyle =
            e.style || meta.style || (meta.dashed ? 'dashed' : 'solid');
          const dash = edgeStyle === 'dashed' ? '8 5' : edgeStyle === 'dotted' ? '2 4' : undefined;
          const rawDx = sb0.x - sa0.x, rawDy = sb0.y - sa0.y;
          const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
          const halfWA = Math.max(14, 52 * a.scale * (a.wFactor ?? 1) * camera.zoom);
          const halfHA = Math.max(14, 52 * a.scale * (a.hFactor ?? 1) * camera.zoom);
          const halfWB = Math.max(14, 52 * b.scale * (b.wFactor ?? 1) * camera.zoom);
          const halfHB = Math.max(14, 52 * b.scale * (b.hFactor ?? 1) * camera.zoom);
          const ux = rawDx / rawDist, uy = rawDy / rawDist;
          // Intersection with axis-aligned ellipse of each node
          const rA = Math.min(
            rawDist * 0.38,
            Math.max(16, (halfWA * halfHA) / Math.max(1e-6, Math.hypot(halfHA * ux, halfWA * uy)))
          );
          const rB = Math.min(
            rawDist * 0.38,
            Math.max(16, (halfWB * halfHB) / Math.max(1e-6, Math.hypot(halfHB * ux, halfWB * uy)))
          );
          const sa = { x: sa0.x + ux * rA, y: sa0.y + uy * rA };
          const sb = { x: sb0.x - ux * rB, y: sb0.y - uy * rB };
          const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2;
          const dx = sb.x - sa.x, dy = sb.y - sa.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const curv = Math.min(48, dist * 0.14);
          const nx = (-dy / dist) * curv, ny = (dx / dist) * curv;
          const cpx = mx + nx, cpy = my + ny;
          const path = `M ${sa.x} ${sa.y} Q ${cpx} ${cpy} ${sb.x} ${sb.y}`;
          const pointAt = (t: number) => {
            const omt = 1 - t;
            return { x: omt * omt * sa.x + 2 * omt * t * cpx + t * t * sb.x, y: omt * omt * sa.y + 2 * omt * t * cpy + t * t * sb.y };
          };
          const tangentAt = (t: number) => {
            const omt = 1 - t;
            const tx = 2 * omt * (cpx - sa.x) + 2 * t * (sb.x - cpx);
            const ty = 2 * omt * (cpy - sa.y) + 2 * t * (sb.y - cpy);
            const len = Math.sqrt(tx * tx + ty * ty) || 1;
            return { x: tx / len, y: ty / len };
          };
          const arrowAt = (t: number, size = 12) => {
            const p = pointAt(t), tan = tangentAt(t);
            const px = -tan.y, py = tan.x;
            const tip = { x: p.x + tan.x * size, y: p.y + tan.y * size };
            const left = { x: p.x - tan.x * size * 0.65 + px * size * 0.62, y: p.y - tan.y * size * 0.65 + py * size * 0.62 };
            const right = { x: p.x - tan.x * size * 0.65 - px * size * 0.62, y: p.y - tan.y * size * 0.65 - py * size * 0.62 };
            return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
          };
          const strokeW = isEdgeSelected ? 3.2 : isPathEdge ? 2.8 : isEdgeHover ? 2.6 : isHi ? 2.2 : 1.2;
          const opacity = isDim ? 0.06 : isEdgeSelected || isPathEdge || isEdgeHover ? 1 : isHi ? 0.9 : 0.28;
          const labelText = (e.label || '').trim() || meta.label;
          const baseFs = e.fontSize ?? meta.fontSize ?? defaultLinkFontSizeRef.current ?? 12;
          const labelFontSize = Math.max(8, Math.min(baseFs + 4, baseFs * (0.85 + Math.min(dist, 400) / 800)));
          const showLabel = !!labelText && dist > (isVeryLarge ? 100 : isLargeGraph ? 80 : 36) && (!isLargeGraph || cameraRef.current.zoom > 0.55);
          const mid = pointAt(0.5);
          const labelPathId = `edge-label-${e.id}`;
          const labelPathD = sb.x < sa.x ? `M ${sb.x} ${sb.y} Q ${cpx} ${cpy} ${sa.x} ${sa.y}` : path;
          const showInsert = !!onInsertOnEdge && dist > 48 && (isEdgeHover || isEdgeSelected) && !connectMode && !isVeryLarge;
          const showArrows = dist > (isVeryLarge ? 75 : isLargeGraph ? 60 : 40) && !isDim;
          const arrowSize = Math.max(11, strokeW + 8);

          return (
            <g key={e.id} onMouseEnter={() => setHoveredEdgeId(e.id)} onMouseLeave={() => setHoveredEdgeId((cur) => (cur === e.id ? null : cur))}>
              <path d={path} fill="none" stroke="transparent" strokeWidth={18} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (multiSelectKindRef.current === 'concepts' && !(ev.ctrlKey || ev.metaKey)) return;
                  onSelectEdge?.(e.id, {
                    additive:
                      multiSelectKindRef.current === 'edges' ||
                      ev.ctrlKey ||
                      ev.metaKey,
                  });
                }}
                onDoubleClick={(ev) => { ev.stopPropagation(); onInsertOnEdge?.(e.id); }} />
              {isPathEdge && (
                <path
                  d={path}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth={strokeW + 8}
                  strokeOpacity={0.28}
                  strokeLinecap="round"
                  className="pointer-events-none"
                  style={pathCol ? { filter: `drop-shadow(0 0 6px ${edgeColor})` } : undefined}
                />
              )}
              <path id={`edge-path-${e.id}`} d={path} fill="none" stroke={edgeColor} strokeWidth={strokeW} strokeOpacity={opacity} strokeDasharray={dash} className="pointer-events-none" />
              {showArrows && (
                <>
                  <path d={arrowAt(0.25, arrowSize)} fill={edgeColor} opacity={opacity * 0.95} className="pointer-events-none" />
                  <path d={arrowAt(0.75, arrowSize)} fill={edgeColor} opacity={opacity * 0.95} className="pointer-events-none" />
                </>
              )}
              {showLabel && (
                <>
                  <path id={labelPathId} d={labelPathD} fill="none" stroke="none" className="pointer-events-none" />
                  <text fill={edgeColor} fontSize={labelFontSize} fontWeight={500} opacity={isDim ? 0.12 : 0.92} className="pointer-events-none" dy={-2}
                    style={{ fontFamily: 'Inter, system-ui, sans-serif', paintOrder: 'stroke', stroke: 'rgba(10,10,15,0.9)', strokeWidth: Math.max(2.5, labelFontSize * 0.32) }}>
                    <textPath href={`#${labelPathId}`} startOffset="50%" textAnchor="middle">{labelText}</textPath>
                  </text>
                </>
              )}
              {showInsert && (
                <g data-edge-action="insert" style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); onInsertOnEdge?.(e.id); }}>
                  <title>Insérer un concept</title>
                  <circle cx={mid.x} cy={mid.y} r={11} fill="#12121a" stroke={edgeColor} strokeWidth={1.5} opacity={0.95} />
                  <line x1={mid.x - 4} y1={mid.y} x2={mid.x + 4} y2={mid.y} stroke={edgeColor} strokeWidth={1.6} strokeLinecap="round" />
                  <line x1={mid.x} y1={mid.y - 4} x2={mid.x} y2={mid.y + 4} stroke={edgeColor} strokeWidth={1.6} strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}
        {connectMode && connectFrom && cursorWorld && (() => {
          const a = nodeMap.get(connectFrom);
          if (!a) return null;
          const sa = worldToScreen(a.x, a.y, camera, viewport);
          const sb = worldToScreen(cursorWorld.x, cursorWorld.y, camera, viewport);
          return (
            <g>
              <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />
              <circle cx={sa.x} cy={sa.y} r={7} fill="#a78bfa" opacity={0.55}><animate attributeName="r" values="5;11;5" dur="1.1s" repeatCount="indefinite" /></circle>
              <circle cx={sb.x} cy={sb.y} r={4} fill="#c4b5fd" opacity={0.8} />
            </g>
          );
        })()}
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        {visibleNodes.map((n) => {
          const s = worldToScreen(n.x, n.y, camera, viewport);
          const isSelected = selectedSet.has(n.id);
          const isHighlighted = highlightedIds.has(n.id) || isSelected;
          const isDim = selectedIds.length > 0 && !isHighlighted && (highlightedIds.size > 0 || !isSelected);
          const scale = n.scale;
          const screenSize = 104 * scale * camera.zoom;
          return (
            <div key={n.id} data-node-id={n.id} className="absolute pointer-events-auto"
              style={{
                left: s.x, top: s.y, transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 50 : isHighlighted ? 40 : 10 + Math.min(n.depth, 20),
                opacity: isDim ? 0.22 : 1, transition: 'opacity 0.15s ease',
              }}>
              <NodeCard
                node={n}
                screenSize={screenSize}
                selected={isSelected}
                highlighted={isHighlighted}
                zoom={camera.zoom}
                onAddChild={onAddChild}
                titleInside={titleInside}
              />
            </div>
          );
        })}
      </div>

      {marquee && (
        <div className="absolute pointer-events-none border border-violet-400/70 bg-violet-500/10 rounded-sm z-[5]"
          style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="px-3 py-1 rounded-full bg-white/5 backdrop-blur border border-white/10 text-[11px] text-white/50 font-mono tracking-wide">{formatZoom(camera.zoom)}</div>
      </div>
    </div>
  );
}
