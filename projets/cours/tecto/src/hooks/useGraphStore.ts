import { useCallback, useMemo, useReducer, useRef } from 'react';
import { createEmptyGraph } from '../data/seedGraph';
import {
  CHILD_SCALE_RATIO,
  childScale,
  hierarchicalChildScale,
  findEmptySpot,
  isHierarchyStroke,
  normalizeGraphData,
  placeChild,
  sanitizeEdges,
  setNodeScaleCascaded,
  scaleSubtree,
} from '../lib/layout';
import { deleteNodesSmart } from '../lib/deleteGraph';
import { generateSubConcepts, generateWebSubConcepts } from '../lib/ai';
import { serializeProject, parseProject } from '../lib/projectStorage';
import type {
  EdgeStyle, GraphData, KnowledgeEdge, KnowledgeNode, RelationType, RelationTypeDef, RelationTypeOverride,
} from '../lib/types';
import { defaultStyleForRelation, isHierarchyType, NODE_COLORS } from '../lib/types';

const MAX_HISTORY = 80;

/** Preserve saved layout: keep x,y,scale,depth,parentId exactly as stored (fix for "mise en place complètement changée"). */
function preservePositions(graph: GraphData): GraphData {
  const ctx = {
    customRelationTypes: graph.customRelationTypes,
    relationOverrides: graph.relationOverrides,
    mapKind: graph.mapKind,
  };
  const edges = sanitizeEdges(graph.edges ?? [], ctx);
  const byId = new Set(graph.nodes.map((n) => n.id));
  const nodes = graph.nodes.map((n) => ({
    ...n,
    scaleLocked: n.scaleLocked ?? true,
    parentId: n.parentId && !byId.has(n.parentId) ? undefined : n.parentId,
  }));
  return { ...graph, edges, nodes };
}

/** Soft renorm: edge styles + parentIds, keep positions & locked scales (import/load). */
function renormHierarchy(state: GraphData): GraphData {
  return normalizeGraphData(state, { forceScales: false });
}

/** Hard renorm: also force 60% hierarchy scales (after new hierarchical links). */
function renormHierarchyForceScales(state: GraphData): GraphData {
  return normalizeGraphData(state, { forceScales: true });
}

function stampEdgeStyle(edge: KnowledgeEdge, state: GraphData): KnowledgeEdge {
  let s = edge.style;
  // Only fill missing style — never rewrite explicit tirets fins
  if (s !== 'solid' && s !== 'dashed' && s !== 'dotted') {
    s = defaultStyleForRelation(
      edge.type,
      state.customRelationTypes,
      state.relationOverrides
    );
  }
  // New child/parent connections default to solid (hierarchy), unless caller set dotted
  if (
    (edge.type === 'child' || edge.type === 'parent') &&
    edge.style !== 'dotted' &&
    edge.style !== 'dashed' &&
    edge.style !== 'solid'
  ) {
    s = 'solid';
  }
  return { ...edge, style: s };
}

function applyHierarchicalEdge(state: GraphData, edge: KnowledgeEdge): GraphData {
  // Lien hiérarchique (enfant, contenu, etc.) → forcer les tailles 60 %
  const hierarchical = isHierarchyType(
    edge.type,
    state.customRelationTypes
  ) && isHierarchyStroke(edge);
  if (hierarchical) {
    // Déverrouille les nœuds touchés (sauf verrou utilisateur explicite déjà géré par forceScales)
    const touched = new Set([edge.source, edge.target]);
    const unlocked = {
      ...state,
      nodes: state.nodes.map((n) =>
        touched.has(n.id) ? { ...n, scaleLocked: false } : n
      ),
    };
    return renormHierarchyForceScales(unlocked);
  }
  return renormHierarchy(state);
}

type Action =
  | { type: 'SET_GRAPH'; data: GraphData }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'SET_DEFAULT_NODE_COLOR'; color: string | null }
  | { type: 'UPDATE_NODE_COLOR_SEGMENTS'; id: string; colors: string[] }
  | { type: 'ADD_CUSTOM_COLOR'; color: string }
  | { type: 'REMOVE_CUSTOM_COLOR'; color: string }
  | { type: 'SET_RELATION_COLOR'; relation: RelationType; color: string }
  | { type: 'RESET_RELATION_COLOR'; relation: RelationType }
  | { type: 'PATCH_RELATION_TYPE'; id: string; patch: RelationTypeOverride & { label?: string; style?: EdgeStyle } }
  | { type: 'ADD_RELATION_TYPE'; def: RelationTypeDef }
  | { type: 'REMOVE_RELATION_TYPE'; id: string }
  | { type: 'SET_LEGEND_SIZE'; width: number; height: number }
  | { type: 'SET_CONCEPT_LEGEND_SIZE'; width: number; height: number }
  | { type: 'SET_COLOR_GROUP_LABEL'; color: string; label: string }
  | { type: 'CLEAR_COLOR_GROUP_LABEL'; color: string }
  | { type: 'SET_DEFAULT_LINK_FONT'; size: number }
  | { type: 'TOGGLE_FAVORITE_ICON'; icon: string }
  | { type: 'ADD_NODE'; node: KnowledgeNode; edge?: KnowledgeEdge }
  | { type: 'UPDATE_NODE'; id: string; patch: Partial<KnowledgeNode> }
  | { type: 'UPDATE_NODES'; ids: string[]; patch: Partial<KnowledgeNode> }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'DELETE_NODES'; ids: string[] }
  | { type: 'DELETE_WITH_BRIDGES'; ids: string[]; bridges: KnowledgeEdge[] }
  | { type: 'MOVE_NODE'; id: string; x: number; y: number }
  | { type: 'MOVE_NODES'; moves: { id: string; x: number; y: number }[] }
  | { type: 'INSERT_ON_EDGE'; edgeId: string; node: KnowledgeNode }
  | { type: 'ADD_EDGE'; edge: KnowledgeEdge }
  | { type: 'UPDATE_EDGE'; id: string; patch: Partial<KnowledgeEdge> }
  | { type: 'UPDATE_EDGES'; ids: string[]; patch: Partial<KnowledgeEdge> }
  | { type: 'DELETE_EDGE'; id: string }
  | { type: 'DELETE_EDGES'; ids: string[] }
  | { type: 'ADD_SUBCONCEPTS'; parentId: string }
  | { type: 'ADD_WEB_SUBCONCEPTS'; parentId: string; query: string; deep: boolean }
  | { type: 'CLEAR' }
  | { type: 'SET_MAP_KIND'; mapKind: 'universe' | 'mindmap' }
  | { type: 'REPLACE'; data: GraphData };

function normalizeColor(c: string) { return c.trim().toLowerCase(); }

function cloneGraph(g: GraphData): GraphData {
  return {
    projectName: g.projectName,
    mapKind: g.mapKind === 'mindmap' ? 'mindmap' : 'universe',
    customColors: g.customColors ? [...g.customColors] : [],
    relationColors: g.relationColors ? { ...g.relationColors } : {},
    relationOverrides: g.relationOverrides
      ? Object.fromEntries(Object.entries(g.relationOverrides).map(([k, v]) => [k, { ...v }]))
      : {},
    customRelationTypes: g.customRelationTypes ? g.customRelationTypes.map((t) => ({ ...t })) : [],
    favoriteIcons: g.favoriteIcons ? [...g.favoriteIcons] : [],
    legendSize: g.legendSize ? { ...g.legendSize } : undefined,
    conceptLegendSize: g.conceptLegendSize ? { ...g.conceptLegendSize } : undefined,
    defaultLinkFontSize: g.defaultLinkFontSize,
    defaultNodeColor: (g as any).defaultNodeColor ?? null,
    colorGroupLabels: (g as any).colorGroupLabels ? { ...(g as any).colorGroupLabels } : {},
    nodes: g.nodes.map((n) => ({ ...n, colorSegments: (n as any).colorSegments ? [...(n as any).colorSegments] : undefined, tags: [...n.tags], resources: n.resources.map((r) => ({ ...r })), metadata: { ...n.metadata } })),
    edges: g.edges.map((e) => ({ ...e })),
  };
}

function reducer(state: GraphData, action: Action): GraphData {
  switch (action.type) {
    case 'SET_GRAPH':
      // Load/import: preserve saved layout exactly (fix "mise en place changée" on reload)
      return preservePositions(action.data);
    case 'SET_DEFAULT_NODE_COLOR':
      return { ...state, defaultNodeColor: action.color ? action.color.toLowerCase() : null };
    case 'UPDATE_NODE_COLOR_SEGMENTS': {
      const segs = action.colors.map((c) => c.toLowerCase());
      return { ...state, nodes: state.nodes.map((n) => n.id === action.id ? { ...n, colorSegments: segs.length ? segs : undefined, color: segs[0] ?? n.color } : n) };
    }
    case 'REPLACE':
      // Undo / precise snapshots: never reshape the graph
      return action.data;
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name };
    case 'ADD_CUSTOM_COLOR': {
      const color = normalizeColor(action.color);
      if (!color) return state;
      const existing = state.customColors ?? [];
      if (existing.some((c) => normalizeColor(c) === color) || NODE_COLORS.some((c) => normalizeColor(c) === color)) return state;
      return { ...state, customColors: [...existing, action.color] };
    }
    case 'REMOVE_CUSTOM_COLOR': {
      const color = normalizeColor(action.color);
      return { ...state, customColors: (state.customColors ?? []).filter((c) => normalizeColor(c) !== color) };
    }
    case 'SET_RELATION_COLOR':
      return {
        ...state,
        relationColors: { ...(state.relationColors ?? {}), [action.relation]: action.color },
        relationOverrides: {
          ...(state.relationOverrides ?? {}),
          [action.relation]: { ...(state.relationOverrides?.[action.relation] ?? {}), color: action.color },
        },
      };
    case 'RESET_RELATION_COLOR': {
      const next = { ...(state.relationColors ?? {}) };
      delete next[action.relation];
      const ov = { ...(state.relationOverrides ?? {}) };
      if (ov[action.relation]) {
        const { color: _c, ...rest } = ov[action.relation]!;
        if (Object.keys(rest).length) ov[action.relation] = rest;
        else delete ov[action.relation];
      }
      return { ...state, relationColors: next, relationOverrides: ov };
    }
    case 'PATCH_RELATION_TYPE': {
      const { id, patch } = action;
      const customs = state.customRelationTypes ?? [];
      const isCustom = customs.some((t) => t.id === id);
      let customRelationTypes = customs;
      if (isCustom) {
        customRelationTypes = customs.map((t) =>
          t.id === id
            ? {
                ...t,
                label: patch.label ?? t.label,
                color: patch.color ?? t.color,
                style: patch.style ?? t.style,
                dashed: patch.style != null ? patch.style !== 'solid' : patch.dashed ?? t.dashed,
                fontSize: patch.fontSize ?? t.fontSize,
              }
            : t
        );
      }
      return {
        ...state,
        customRelationTypes,
        relationOverrides: {
          ...(state.relationOverrides ?? {}),
          [id]: { ...(state.relationOverrides?.[id] ?? {}), ...patch },
        },
        relationColors: {
          ...(state.relationColors ?? {}),
          ...(patch.color ? { [id]: patch.color } : {}),
        },
      };
    }
    case 'ADD_RELATION_TYPE': {
      const list = state.customRelationTypes ?? [];
      if (list.some((t) => t.id === action.def.id)) return state;
      const def = {
        ...action.def,
        custom: true,
        style: action.def.style || (action.def.dashed ? 'dashed' : ('solid' as EdgeStyle)),
        dashed: action.def.style != null ? action.def.style !== 'solid' : !!action.def.dashed,
      };
      return { ...state, customRelationTypes: [...list, def] };
    }
    case 'REMOVE_RELATION_TYPE': {
      const list = (state.customRelationTypes ?? []).filter((t) => t.id !== action.id);
      const colors = { ...(state.relationColors ?? {}) };
      delete colors[action.id];
      const ov = { ...(state.relationOverrides ?? {}) };
      delete ov[action.id];
      const edges = state.edges.map((e) => (e.type === action.id ? { ...e, type: 'related' as RelationType } : e));
      return { ...state, customRelationTypes: list, relationColors: colors, relationOverrides: ov, edges };
    }
    case 'SET_LEGEND_SIZE':
      return {
        ...state,
        legendSize: {
          width: Math.max(140, Math.min(420, action.width)),
          height: Math.max(80, Math.min(480, action.height)),
        },
      };
    case 'SET_CONCEPT_LEGEND_SIZE':
      return {
        ...state,
        conceptLegendSize: {
          width: Math.max(140, Math.min(420, action.width)),
          height: Math.max(80, Math.min(480, action.height)),
        },
      };
    case 'SET_DEFAULT_LINK_FONT':
      return { ...state, defaultLinkFontSize: Math.max(8, Math.min(28, action.size)) };
    case 'TOGGLE_FAVORITE_ICON': {
      const favs = state.favoriteIcons ?? [];
      const has = favs.includes(action.icon);
      return { ...state, favoriteIcons: has ? favs.filter((i) => i !== action.icon) : [...favs, action.icon] };
    }
    case 'CLEAR':
      return {
        ...createEmptyGraph(state.mapKind === 'mindmap' ? 'mindmap' : 'universe'),
        projectName: state.projectName,
        mapKind: state.mapKind === 'mindmap' ? 'mindmap' : 'universe',
        customColors: state.customColors ?? [],
        favoriteIcons: state.favoriteIcons ?? [],
      };
    case 'SET_MAP_KIND':
      return {
        ...state,
        mapKind: action.mapKind,
        projectName:
          state.projectName === 'Mon univers' && action.mapKind === 'mindmap'
            ? 'Ma mindmap'
            : state.projectName === 'Ma mindmap' && action.mapKind === 'universe'
              ? 'Mon univers'
              : state.projectName,
      };
    case 'ADD_NODE': {
      const nodes = [...state.nodes, action.node];
      const edges = action.edge ? [...state.edges, action.edge] : state.edges;
      return renormHierarchy({ ...state, nodes, edges });
    }
    case 'UPDATE_NODE': {
      // ±10% / scale: ONLY concept size, no renorm, no link stretch
      if (
        action.patch.scale != null &&
        Object.keys(action.patch).every((k) =>
          k === 'scale' || k === 'scaleLocked'
        )
      ) {
        const nodes = setNodeScaleCascaded(
          state.nodes,
          state.edges,
          action.id,
          action.patch.scale as number
        );
        return { ...state, nodes };
      }
      const nodes = state.nodes.map((n) =>
        n.id === action.id ? { ...n, ...action.patch } : n
      );
      const next = { ...state, nodes };
      if (
        action.patch.parentId !== undefined ||
        action.patch.depth != null
      ) {
        return renormHierarchy(next);
      }
      return next;
    }
    case 'UPDATE_NODES': {
      const idSet = new Set(action.ids);
      let nodes = state.nodes;
      if (
        action.patch.scale != null &&
        Object.keys(action.patch).every((k) =>
          k === 'scale' || k === 'scaleLocked'
        )
      ) {
        for (const id of action.ids) {
          nodes = setNodeScaleCascaded(
            nodes,
            state.edges,
            id,
            action.patch.scale as number
          );
        }
        return { ...state, nodes };
      }
      nodes = state.nodes.map((n) =>
        idSet.has(n.id) ? { ...n, ...action.patch } : n
      );
      const next = { ...state, nodes };
      if (
        action.patch.parentId !== undefined ||
        action.patch.depth != null
      ) {
        return renormHierarchy(next);
      }
      return next;
    }
    case 'DELETE_NODE':
      // No full renorm: keep scales/positions so the camera doesn't "jump out"
      return deleteNodesSmart(state, [action.id], []);
    case 'DELETE_NODES':
      return deleteNodesSmart(state, action.ids, []);
    case 'DELETE_WITH_BRIDGES':
      return deleteNodesSmart(state, action.ids, action.bridges);
    case 'MOVE_NODE':
      return { ...state, nodes: state.nodes.map((n) => (n.id === action.id ? { ...n, x: action.x, y: action.y } : n)) };
    case 'MOVE_NODES': {
      const map = new Map(action.moves.map((m) => [m.id, m]));
      return { ...state, nodes: state.nodes.map((n) => { const m = map.get(n.id); return m ? { ...n, x: m.x, y: m.y } : n; }) };
    }
    case 'INSERT_ON_EDGE': {
      const edge = state.edges.find((e) => e.id === action.edgeId);
      if (!edge) return state;
      const mid = action.node;
      const e1: KnowledgeEdge = { id: `e-${edge.source}-${mid.id}-${edge.type}`, source: edge.source, target: mid.id, type: edge.type, label: edge.label, color: edge.color, style: edge.style };
      const e2: KnowledgeEdge = { id: `e-${mid.id}-${edge.target}-${edge.type}`, source: mid.id, target: edge.target, type: edge.type, label: edge.label, color: edge.color, style: edge.style };
      let node = mid;
      let next: GraphData = {
        ...state,
        nodes: [...state.nodes, node],
        edges: [...state.edges.filter((e) => e.id !== action.edgeId), e1, e2],
      };
      return renormHierarchy(next);
    }
    case 'ADD_EDGE': {
      const stamped = stampEdgeStyle(action.edge, state);
      let next: GraphData;
      if (state.edges.some((e) =>
        (e.source === stamped.source && e.target === stamped.target) ||
        (e.source === stamped.target && e.target === stamped.source)
      )) {
        next = {
          ...state,
          edges: state.edges.map((e) => {
            const same =
              (e.source === stamped.source && e.target === stamped.target) ||
              (e.source === stamped.target && e.target === stamped.source);
            // Prefer new type + correct style (never keep stale dotted on child)
            return same
              ? {
                  ...e,
                  source: stamped.source,
                  target: stamped.target,
                  type: stamped.type,
                  label: stamped.label ?? e.label,
                  style: stamped.style,
                  color: stamped.color ?? e.color,
                }
              : e;
          }),
        };
      } else {
        next = { ...state, edges: [...state.edges, stamped] };
      }
      return applyHierarchicalEdge(next, stamped);
    }
    case 'UPDATE_EDGE': {
      const updated = state.edges.map((e) => {
        if (e.id !== action.id) return e;
        const merged = { ...e, ...action.patch };
        // Type change without explicit style → apply type default (child = solid)
        if (action.patch.type && action.patch.style === undefined) {
          // Changing type without style: child/parent → solid; keep existing if set
          if (merged.type === 'child' || merged.type === 'parent') {
            if (action.patch.style === undefined && e.style === undefined) {
              merged.style = 'solid';
            } else if (
              action.patch.type &&
              (merged.type === 'child' || merged.type === 'parent') &&
              !action.patch.style
            ) {
              // New hierarchical type without explicit style
              if (e.style !== 'dotted') merged.style = 'solid';
            }
          } else {
            merged.style = defaultStyleForRelation(
              merged.type,
              state.customRelationTypes,
              state.relationOverrides
            );
          }
        }
        // Tirets fins stay tirets fins — excluded from hierarchy
        return merged;
      });
      return renormHierarchy({ ...state, edges: updated });
    }
    case 'UPDATE_EDGES': {
      const idSet = new Set(action.ids);
      return renormHierarchy({
        ...state,
        edges: state.edges.map((e) => {
          if (!idSet.has(e.id)) return e;
          const merged = { ...e, ...action.patch };
          if (action.patch.type && action.patch.style === undefined) {
            if (
              (merged.type === 'child' || merged.type === 'parent') &&
              e.style !== 'dotted'
            ) {
              merged.style = 'solid';
            } else if (merged.type !== 'child' && merged.type !== 'parent') {
              merged.style = defaultStyleForRelation(
                merged.type,
                state.customRelationTypes,
                state.relationOverrides
              );
            }
          }
          return merged;
        }),
      });
    }
    case 'DELETE_EDGE': {
      // Removing a link must not rescale the whole map
      const edges = state.edges.filter((e) => e.id !== action.id);
      const edge = state.edges.find((e) => e.id === action.id);
      let nodes = state.nodes;
      if (edge && isHierarchyStroke(edge)) {
        // Clear parentId only if this edge was the hierarchy link
        nodes = state.nodes.map((n) => {
          if (
            n.parentId &&
            ((edge.source === n.parentId && edge.target === n.id) ||
              (edge.target === n.parentId && edge.source === n.id))
          ) {
            // Only clear if no other hierarchy edge remains to that parent
            const still = edges.some((e) => {
              if (!isHierarchyStroke(e)) return false;
              return (
                (e.source === n.parentId && e.target === n.id) ||
                (e.target === n.parentId && e.source === n.id)
              );
            });
            if (!still) return { ...n, parentId: undefined };
          }
          return n;
        });
      }
      return { ...state, nodes, edges };
    }
    case 'DELETE_EDGES': {
      const idSet = new Set(action.ids);
      const removed = state.edges.filter((e) => idSet.has(e.id));
      const edges = state.edges.filter((e) => !idSet.has(e.id));
      let nodes = state.nodes;
      if (removed.some((e) => isHierarchyStroke(e))) {
        nodes = state.nodes.map((n) => {
          if (!n.parentId) return n;
          const still = edges.some((e) => {
            if (!isHierarchyStroke(e)) return false;
            return (
              (e.source === n.parentId && e.target === n.id) ||
              (e.target === n.parentId && e.source === n.id)
            );
          });
          return still ? n : { ...n, parentId: undefined };
        });
      }
      return { ...state, nodes, edges };
    }
    case 'ADD_SUBCONCEPTS': {
      const parent = state.nodes.find((n) => n.id === action.parentId);
      if (!parent) return state;
      const existing = state.nodes.filter((n) => n.parentId === parent.id);
      const generated = generateSubConcepts(parent, state);
      const newNodes: KnowledgeNode[] = [];
      const newEdges: KnowledgeEdge[] = [];
      generated.forEach((g, i) => {
        const id = `gen-${parent.id}-${Date.now()}-${i}`;
        const pos = placeChild(parent, [...existing, ...newNodes], existing.length + i);
        newNodes.push({
          ...g,
          id,
          x: pos.x,
          y: pos.y,
          parentId: parent.id,
          scale: hierarchicalChildScale(parent.scale, parent.depth, state.mapKind),
          depth: parent.depth + 1,
        });
        // Default hierarchy stroke: solid (tirets fins = excluded from hierarchy)
        newEdges.push({ id: `e-${parent.id}-${id}-child`, source: parent.id, target: id, type: 'child', style: 'solid' });
      });
      return renormHierarchy({
        ...state,
        nodes: [...state.nodes, ...newNodes],
        edges: [...state.edges, ...newEdges],
      });
    }
    case 'ADD_WEB_SUBCONCEPTS': {
      const parent = state.nodes.find((n) => n.id === action.parentId);
      if (!parent) return state;
      const existing = state.nodes.filter((n) => n.parentId === parent.id);
      const generated = generateWebSubConcepts(action.query || parent.title, action.deep, parent);
      const newNodes: KnowledgeNode[] = [];
      const newEdges: KnowledgeEdge[] = [];
      generated.forEach((g, i) => {
        const id = `gen-web-${parent.id}-${Date.now()}-${i}`;
        const pos = placeChild(parent, [...existing, ...newNodes], existing.length + i);
        newNodes.push({
          ...g,
          id,
          x: pos.x,
          y: pos.y,
          parentId: parent.id,
          scale: hierarchicalChildScale(parent.scale, parent.depth, state.mapKind),
          depth: parent.depth + 1,
        });
        newEdges.push({ id: `e-${parent.id}-${id}-child`, source: parent.id, target: id, type: 'child', style: 'solid' });
      });
      return renormHierarchy({
        ...state,
        nodes: [...state.nodes, ...newNodes],
        edges: [...state.edges, ...newEdges],
      });
    }
    case 'SET_COLOR_GROUP_LABEL': {
      const key = action.color.trim().toLowerCase();
      const labels = { ...(state.colorGroupLabels ?? {}) };
      const name = action.label.trim();
      if (!name) delete labels[key];
      else labels[key] = name;
      return { ...state, colorGroupLabels: labels };
    }
    case 'CLEAR_COLOR_GROUP_LABEL': {
      const key = action.color.trim().toLowerCase();
      const labels = { ...(state.colorGroupLabels ?? {}) };
      delete labels[key];
      return { ...state, colorGroupLabels: labels };
    }
    default:
      return state;
  }
}

function isHistoryAction(action: Action): boolean {
  return action.type !== 'REPLACE' && action.type !== 'MOVE_NODE' && action.type !== 'MOVE_NODES';
}

export function useGraphStore() {
  const [graph, dispatchBase] = useReducer(reducer, undefined, createEmptyGraph);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const pastRef = useRef<GraphData[]>([]);
  const futureRef = useRef<GraphData[]>([]);

  const dispatch = useCallback((action: Action) => {
    if (isHistoryAction(action)) {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), cloneGraph(graphRef.current)];
      futureRef.current = [];
    }
    dispatchBase(action);
  }, []);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), cloneGraph(graphRef.current)];
    futureRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return false;
    futureRef.current.push(cloneGraph(graphRef.current));
    dispatchBase({ type: 'REPLACE', data: prev });
    return true;
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return false;
    pastRef.current.push(cloneGraph(graphRef.current));
    dispatchBase({ type: 'REPLACE', data: next });
    return true;
  }, []);

  const setProjectName = useCallback((name: string) => dispatch({ type: 'SET_PROJECT_NAME', name }), [dispatch]);
  const addCustomColor = useCallback((color: string) => dispatch({ type: 'ADD_CUSTOM_COLOR', color }), [dispatch]);
  const removeCustomColor = useCallback((color: string) => dispatch({ type: 'REMOVE_CUSTOM_COLOR', color }), [dispatch]);
  const setRelationColor = useCallback((relation: RelationType, color: string) => dispatch({ type: 'SET_RELATION_COLOR', relation, color }), [dispatch]);
  const resetRelationColor = useCallback((relation: RelationType) => dispatch({ type: 'RESET_RELATION_COLOR', relation }), [dispatch]);
  const addRelationType = useCallback((def: RelationTypeDef) => dispatch({ type: 'ADD_RELATION_TYPE', def }), [dispatch]);
  const removeRelationType = useCallback((id: string) => dispatch({ type: 'REMOVE_RELATION_TYPE', id }), [dispatch]);
  const patchRelationType = useCallback((id: string, patch: RelationTypeOverride & { label?: string; style?: EdgeStyle }) => dispatch({ type: 'PATCH_RELATION_TYPE', id, patch }), [dispatch]);
  const setLegendSize = useCallback((width: number, height: number) => dispatch({ type: 'SET_LEGEND_SIZE', width, height }), [dispatch]);
  const setConceptLegendSize = useCallback((width: number, height: number) => dispatch({ type: 'SET_CONCEPT_LEGEND_SIZE', width, height }), [dispatch]);
  const setDefaultNodeColor = useCallback((color: string | null) => dispatch({ type: 'SET_DEFAULT_NODE_COLOR', color: color ? color.toLowerCase() : null }), [dispatch]);
  const updateNodeColorSegments = useCallback((id: string, colors: string[]) => dispatch({ type: 'UPDATE_NODE_COLOR_SEGMENTS', id, colors }), [dispatch]);
  const setDefaultLinkFontSize = useCallback((size: number) => dispatch({ type: 'SET_DEFAULT_LINK_FONT', size }), [dispatch]);
  const toggleFavoriteIcon = useCallback((icon: string) => dispatch({ type: 'TOGGLE_FAVORITE_ICON', icon }), [dispatch]);

  const scaleNodesByFactor = useCallback((ids: string[], factor: number) => {
    if (!ids.length) return;
    pushHistory();
    const g = graphRef.current;
    let nodes = g.nodes;
    for (const id of ids) {
      // Size only — no position change, no full renorm
      nodes = scaleSubtree(nodes, g.edges, id, factor, undefined, false);
    }
    dispatchBase({
      type: 'REPLACE',
      data: { ...g, nodes },
    });
  }, [pushHistory]);

  const addNode = useCallback((partial: Partial<KnowledgeNode> & { title?: string }, parentId?: string, near?: { x: number; y: number }) => {
    const g = graphRef.current;
    const parent = parentId ? g.nodes.find((n) => n.id === parentId) : undefined;
    const depth = parent ? parent.depth + 1 : 0;
    // Children of same parent share one size (match existing siblings if any)
    const siblings = parent
      ? g.nodes.filter((n) => n.parentId === parent.id)
      : [];
    const siblingScale =
      siblings.length > 0
        ? siblings.reduce((s, n) => s + n.scale, 0) / siblings.length
        : null;
    const scale =
      partial.scale ??
      (siblingScale != null
        ? siblingScale
        : parent
          ? hierarchicalChildScale(parent.scale, parent.depth, g.mapKind)
          : 1);
    const pos = parent
      ? placeChild(parent, g.nodes.filter((n) => n.parentId === parent.id), g.nodes.filter((n) => n.parentId === parent.id).length)
      : findEmptySpot(g.nodes, near?.x ?? 0, near?.y ?? 0);
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Couleur : priorité partial.color > couleur par défaut choisie > héritage parent > palette cyclique
    const finalColor = partial.color ?? (g.defaultNodeColor ?? parent?.color ?? NODE_COLORS[g.nodes.length % NODE_COLORS.length]);
    const node: KnowledgeNode = {
      id, title: partial.title ?? '', description: partial.description ?? '',
      x: pos.x, y: pos.y,
      color: finalColor,
      icon: partial.icon ?? parent?.icon ?? 'circle',
      tags: partial.tags ?? [], notes: partial.notes ?? '', resources: partial.resources ?? [],
      imageUrl: partial.imageUrl, metadata: partial.metadata ?? {},
      depth, scale, parentId: parent?.id,
      // Ne pas verrouiller auto les enfants : la normalisation hiérarchique doit s'appliquer
      scaleLocked: partial.scaleLocked ?? false,
      isPrimary: partial.isPrimary,
      wFactor: partial.wFactor ?? 1,
      hFactor: partial.hFactor ?? 1,
    };
    const edge: KnowledgeEdge | undefined = parent
      ? { id: `e-${parent.id}-${id}-child`, source: parent.id, target: id, type: 'child', style: 'solid' }
      : undefined;
    dispatch({ type: 'ADD_NODE', node, edge });
    // All children of a parent share the same size
    if (parent) {
      const g2 = graphRef.current;
      // graphRef not yet updated — equalize via follow-up updates after tick
      queueMicrotask(() => {
        const g3 = graphRef.current;
        const sibs = g3.nodes.filter((n) => n.parentId === parent.id);
        if (sibs.length < 2) return;
        const target =
          sibs.find((n) => n.id === node.id)?.scale ??
          sibs.reduce((s, n) => s + n.scale, 0) / sibs.length;
        for (const s of sibs) {
          if (Math.abs(s.scale - target) / Math.max(target, 1e-15) > 0.001) {
            dispatchBase({
              type: 'UPDATE_NODE',
              id: s.id,
              patch: { scale: target, scaleLocked: false },
            });
          }
        }
      });
    }
    return node;
  }, [dispatch]);

  const addParent = useCallback((childId: string, partial?: Partial<KnowledgeNode>) => {
    const g = graphRef.current;
    const child = g.nodes.find((n) => n.id === childId);
    if (!child) return null;
    const grandParentId = child.parentId;
    const grandParent = grandParentId ? g.nodes.find((n) => n.id === grandParentId) : undefined;
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const parentScale = Math.min(2.2, child.scale / CHILD_SCALE_RATIO);
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 * parentScale;
    const node: KnowledgeNode = {
      id, title: partial?.title ?? '', description: partial?.description ?? '',
      x: child.x + Math.cos(angle) * dist, y: child.y + Math.sin(angle) * dist,
      color: partial?.color ?? child.color, icon: partial?.icon ?? child.icon,
      tags: partial?.tags ?? [], notes: '', resources: [], metadata: {},
      depth: grandParent ? grandParent.depth + 1 : Math.max(0, child.depth - 1),
      scale: parentScale, parentId: grandParent?.id,
    };
    pushHistory();
    dispatchBase({ type: 'ADD_NODE', node, edge: { id: `e-${id}-${childId}-child`, source: id, target: childId, type: 'child', style: 'solid' } });
    dispatchBase({
      type: 'UPDATE_NODE',
      id: childId,
      patch: {
        parentId: id,
        depth: node.depth + 1,
        scale: hierarchicalChildScale(parentScale, node.depth, g.mapKind),
      },
    });
    if (grandParent) {
      const oldEdge = graphRef.current.edges.find((e) => e.source === grandParent.id && e.target === childId && e.type === 'child');
      if (oldEdge) dispatchBase({ type: 'DELETE_EDGE', id: oldEdge.id });
      dispatchBase({ type: 'ADD_EDGE', edge: { id: `e-${grandParent.id}-${id}-child`, source: grandParent.id, target: id, type: 'child', style: 'solid' } });
    }
    return node;
  }, [pushHistory]);

  const updateNode = useCallback((id: string, patch: Partial<KnowledgeNode>) => {
    const keys = Object.keys(patch);
    // Scale → cascade subtree (sizes + links) via UPDATE_NODE special path
    if (keys.includes('scale') && keys.every((k) => k === 'scale' || k === 'scaleLocked')) {
      dispatch({
        type: 'UPDATE_NODE',
        id,
        patch: { scale: patch.scale, scaleLocked: true },
      });
      return;
    }
    if (keys.includes('scale')) patch = { ...patch, scaleLocked: true };
    dispatch({ type: 'UPDATE_NODE', id, patch });
  }, [dispatch]);

  const updateNodes = useCallback((ids: string[], patch: Partial<KnowledgeNode>) => {
    if (!ids.length) return;
    const keys = Object.keys(patch);
    if (keys.includes('scale') && keys.every((k) => k === 'scale' || k === 'scaleLocked')) {
      dispatch({
        type: 'UPDATE_NODES',
        ids,
        patch: { scale: patch.scale, scaleLocked: true },
      });
      return;
    }
    if (keys.includes('scale')) patch = { ...patch, scaleLocked: true };
    dispatch({ type: 'UPDATE_NODES', ids, patch });
  }, [dispatch]);

  const deleteNode = useCallback((id: string) => dispatch({ type: 'DELETE_NODE', id }), [dispatch]);
  const deleteNodes = useCallback((ids: string[]) => { if (ids.length) dispatch({ type: 'DELETE_NODES', ids }); }, [dispatch]);
  const deleteWithBridges = useCallback((ids: string[], bridges: { source: string; target: string; type: RelationType; label?: string }[]) => {
    if (!ids.length) return;
    const edges: KnowledgeEdge[] = bridges.map((b, i) => ({ id: `bridge-${Date.now()}-${i}`, source: b.source, target: b.target, type: b.type, label: b.label }));
    dispatch({ type: 'DELETE_WITH_BRIDGES', ids, bridges: edges });
  }, [dispatch]);

  const moveNode = useCallback((id: string, x: number, y: number) => { dispatchBase({ type: 'MOVE_NODE', id, x, y }); }, []);
  const moveNodes = useCallback((moves: { id: string; x: number; y: number }[]) => { dispatchBase({ type: 'MOVE_NODES', moves }); }, []);
  const beginMove = useCallback(() => { pushHistory(); }, [pushHistory]);

  const connect = useCallback((source: string, target: string, type: RelationType = 'related', label?: string) => {
    if (source === target) return;
    const g = graphRef.current;
    const style = defaultStyleForRelation(type, g.customRelationTypes, g.relationOverrides);
    dispatch({
      type: 'ADD_EDGE',
      edge: {
        id: `e-${source}-${target}-${type}-${Date.now()}`,
        source,
        target,
        type,
        label,
        style,
      },
    });
  }, [dispatch]);

  const connectMany = useCallback((source: string, targets: string[], type: RelationType = 'related', label?: string) => {
    const g = graphRef.current;
    const style = defaultStyleForRelation(type, g.customRelationTypes, g.relationOverrides);
    for (const target of targets) {
      if (source === target) continue;
      dispatch({
        type: 'ADD_EDGE',
        edge: {
          id: `e-${source}-${target}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source,
          target,
          type,
          label,
          style,
        },
      });
    }
  }, [dispatch]);

  const updateEdge = useCallback((id: string, patch: Partial<KnowledgeEdge>) => dispatch({ type: 'UPDATE_EDGE', id, patch }), [dispatch]);
  const updateEdges = useCallback((ids: string[], patch: Partial<KnowledgeEdge>) => { if (ids.length) dispatch({ type: 'UPDATE_EDGES', ids, patch }); }, [dispatch]);
  const deleteEdge = useCallback((id: string) => dispatch({ type: 'DELETE_EDGE', id }), [dispatch]);
  const deleteEdges = useCallback((ids: string[]) => { if (ids.length) dispatch({ type: 'DELETE_EDGES', ids }); }, [dispatch]);

  const insertOnEdge = useCallback((edgeId: string, partial?: Partial<KnowledgeNode>) => {
    const g = graphRef.current;
    const edge = g.edges.find((e) => e.id === edgeId);
    if (!edge) return null;
    const a = g.nodes.find((n) => n.id === edge.source);
    const b = g.nodes.find((n) => n.id === edge.target);
    if (!a || !b) return null;
    const scale = Math.min(a.scale, b.scale) * 0.85;
    const node: KnowledgeNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: partial?.title ?? '', description: partial?.description ?? '',
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      color: partial?.color ?? a.color, icon: partial?.icon ?? 'circle',
      tags: partial?.tags ?? [], notes: partial?.notes ?? '', resources: partial?.resources ?? [],
      imageUrl: partial?.imageUrl, metadata: partial?.metadata ?? {},
      depth: Math.max(a.depth, b.depth), scale,
      parentId: undefined,
      scaleLocked: false,
    };
    dispatch({ type: 'INSERT_ON_EDGE', edgeId, node });
    return node;
  }, [dispatch]);

  const expandWithAI = useCallback((parentId: string) => dispatch({ type: 'ADD_SUBCONCEPTS', parentId }), [dispatch]);
  const expandWithWebAI = useCallback((parentId: string, query: string, deep: boolean) => dispatch({ type: 'ADD_WEB_SUBCONCEPTS', parentId, query, deep }), [dispatch]);
  const clearGraph = useCallback(() => dispatch({ type: 'CLEAR' }), [dispatch]);

  const setMapKind = useCallback((mapKind: 'universe' | 'mindmap') => {
    dispatchBase({ type: 'SET_MAP_KIND', mapKind });
  }, []);

  const newGraph = useCallback((mapKind: 'universe' | 'mindmap' = 'universe') => {
    dispatchBase({ type: 'SET_GRAPH', data: createEmptyGraph(mapKind) });
    pastRef.current = [];
    futureRef.current = [];
  }, []);
  const exportJSON = useCallback(() => serializeProject(graph), [graph]);
  const exportMarkdown = useCallback(() => {
    const name = graph.projectName?.trim() || 'Knowledge Universe';
    const lines = [`# ${name}`, ''];
    const byDepth = [...graph.nodes].sort((a, b) => a.depth - b.depth);
    for (const n of byDepth) {
      lines.push(`${'#'.repeat(Math.min(n.depth + 1, 6))} ${n.title || 'Sans titre'}`, '', n.description || '');
      if (n.tags.length) lines.push(`\n_Tags: ${n.tags.join(', ')}_`);
      lines.push('');
    }
    lines.push('## Relations', '');
    for (const e of graph.edges) {
      const s = graph.nodes.find((n) => n.id === e.source)?.title || e.source;
      const t = graph.nodes.find((n) => n.id === e.target)?.title || e.target;
      lines.push(`- ${s} —[${e.type}]→ ${t}`);
    }
    return lines.join('\n');
  }, [graph]);

  const importJSON = useCallback((raw: string) => {
    const data = parseProject(raw);
    if (!data) return false;
    // SET_GRAPH always renorms
    dispatch({ type: 'SET_GRAPH', data });
    return true;
  }, [dispatch]);

  const loadGraph = useCallback((data: GraphData) => {
    dispatch({ type: 'SET_GRAPH', data });
  }, [dispatch]);

  /** Manual / startup full normalize */
  const setColorGroupLabel = useCallback((color: string, label: string) => {
    dispatchBase({ type: 'SET_COLOR_GROUP_LABEL', color, label });
  }, []);

  const clearColorGroupLabel = useCallback((color: string) => {
    dispatchBase({ type: 'CLEAR_COLOR_GROUP_LABEL', color });
  }, []);

  const normalizeNow = useCallback((forceScales = false) => {
    const base = graphRef.current;
    const data = forceScales
      ? renormHierarchyForceScales(base)
      : renormHierarchy(base);
    // REPLACE avoids double history; renorm inside SET/REPLACE is soft and
    // keeps unlocked hierarchical scales.
    dispatchBase({ type: 'REPLACE', data });
  }, []);

  const stats = useMemo(() => ({
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    maxDepth: graph.nodes.length ? Math.max(...graph.nodes.map((n) => n.depth)) : 0,
  }), [graph]);

  return {
    graph, projectName: graph.projectName ?? '',
    mapKind: graph.mapKind === 'mindmap' ? 'mindmap' : 'universe',
    customColors: graph.customColors ?? [],
    relationColors: graph.relationColors ?? {},
    relationOverrides: graph.relationOverrides ?? {},
    customRelationTypes: graph.customRelationTypes ?? [],
    favoriteIcons: graph.favoriteIcons ?? [],
    legendSize: graph.legendSize ?? { width: 200, height: 200 },
    conceptLegendSize: graph.conceptLegendSize ?? graph.legendSize ?? { width: 200, height: 200 },
    defaultLinkFontSize: graph.defaultLinkFontSize ?? 12,
    defaultNodeColor: (graph as any).defaultNodeColor ?? null,
    setProjectName, setMapKind, newGraph, addCustomColor, removeCustomColor,
    setRelationColor, resetRelationColor, addRelationType, removeRelationType, patchRelationType,
    setLegendSize, setConceptLegendSize, setDefaultNodeColor, updateNodeColorSegments, setDefaultLinkFontSize, scaleNodesByFactor, toggleFavoriteIcon,
    addNode, addParent, updateNode, updateNodes, deleteNode, deleteNodes, deleteWithBridges,
    moveNode, moveNodes, beginMove, connect, connectMany,
    updateEdge, updateEdges, deleteEdge, deleteEdges, insertOnEdge,
    expandWithAI, expandWithWebAI, clearGraph, exportJSON, exportMarkdown, importJSON, loadGraph, normalizeNow, setColorGroupLabel, clearColorGroupLabel, colorGroupLabels: graph.colorGroupLabels ?? {},
    undo, redo, canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0, stats,
  };
}

export type GraphStore = ReturnType<typeof useGraphStore>;
