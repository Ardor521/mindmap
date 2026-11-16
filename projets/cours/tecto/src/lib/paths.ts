import type { GraphData, KnowledgeEdge, KnowledgeNode } from './types';
import {
  buildHierarchyParents,
  isHierarchyStroke,
  pairFromEdge,
  type RelationContext,
} from './layout';

function ctxOf(data: GraphData): RelationContext {
  return {
    customRelationTypes: data.customRelationTypes,
    relationOverrides: data.relationOverrides,
  };
}

/** Parent index — same rules as normalize (related-only multi-parent, semantic types). */
export function buildParentIndex(data: GraphData) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const edges = data.edges ?? [];
  const ctx = ctxOf(data);
  const parentSets = buildHierarchyParents(data.nodes, edges, ctx);

  const parents = new Map<string, { parentId: string; edgeId: string }[]>();
  const children = new Map<string, { childId: string; edgeId: string }[]>();

  for (const [childId, pset] of parentSets) {
    for (const parentId of pset) {
      // Find best matching edge for illumination
      let edge =
        edges.find((e) => {
          if (!isHierarchyStroke(e)) return false;
          const pair = pairFromEdge(e, byId, edges, ctx);
          return pair?.childId === childId && pair.parentId === parentId;
        }) ||
        edges.find((e) => {
          if (!isHierarchyStroke(e)) return false;
          return (
            (e.source === parentId && e.target === childId) ||
            (e.source === childId && e.target === parentId)
          );
        });

      // Related-only: accept related edge between them
      if (!edge) {
        edge = edges.find(
          (e) =>
            isHierarchyStroke(e) &&
            ((e.source === parentId && e.target === childId) ||
              (e.source === childId && e.target === parentId))
        );
      }
      if (!edge) continue;

      if (!parents.has(childId)) parents.set(childId, []);
      if (!parents.get(childId)!.some((p) => p.parentId === parentId)) {
        parents.get(childId)!.push({ parentId, edgeId: edge.id });
      }
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId)!.push({ childId, edgeId: edge.id });
    }
  }

  return { parents, children, byId };
}

export interface AscentPath {
  nodeIds: string[];
  edgeIds: string[];
  rootId: string;
  colorIndex: number;
}

const PATH_COLORS = [
  '#a78bfa',
  '#22d3ee',
  '#f472b6',
  '#4ade80',
  '#fbbf24',
  '#fb7185',
  '#818cf8',
  '#2dd4bf',
];

export function pathColor(index: number): string {
  return PATH_COLORS[index % PATH_COLORS.length];
}

export function getAllAscentPaths(nodeId: string, data: GraphData): AscentPath[] {
  const { parents, byId } = buildParentIndex(data);
  if (!byId.has(nodeId)) return [];

  const paths: AscentPath[] = [];

  const dfs = (
    cur: string,
    chainNodes: string[],
    chainEdges: string[],
    visited: Set<string>
  ) => {
    const ups = (parents.get(cur) || []).filter((u) => !visited.has(u.parentId));
    if (ups.length === 0) {
      paths.push({
        nodeIds: [...chainNodes].reverse(),
        edgeIds: [...chainEdges].reverse(),
        rootId: cur,
        colorIndex: paths.length,
      });
      return;
    }
    for (const { parentId, edgeId } of ups) {
      visited.add(parentId);
      dfs(parentId, [...chainNodes, parentId], [...chainEdges, edgeId], visited);
      visited.delete(parentId);
    }
  };

  dfs(nodeId, [nodeId], [], new Set([nodeId]));

  if (paths.length === 0) {
    paths.push({ nodeIds: [nodeId], edgeIds: [], rootId: nodeId, colorIndex: 0 });
  }

  paths.sort((a, b) => {
    const sa = byId.get(a.rootId)?.scale ?? 0;
    const sb = byId.get(b.rootId)?.scale ?? 0;
    if (sb !== sa) return sb - sa;
    return b.nodeIds.length - a.nodeIds.length;
  });
  paths.forEach((p, i) => {
    p.colorIndex = i;
  });
  return paths;
}

export function getSelectionContext(nodeId: string, data: GraphData) {
  const paths = getAllAscentPaths(nodeId, data);
  const nodeIds = new Set<string>([nodeId]);
  const edgeIds = new Set<string>();
  const edgeColors = new Map<string, string>();
  const nodePathColors = new Map<string, string[]>();

  for (const p of paths) {
    const col = pathColor(p.colorIndex);
    for (const id of p.nodeIds) {
      nodeIds.add(id);
      const arr = nodePathColors.get(id) || [];
      if (!arr.includes(col)) arr.push(col);
      nodePathColors.set(id, arr);
    }
    for (const eid of p.edgeIds) {
      edgeIds.add(eid);
      if (!edgeColors.has(eid)) edgeColors.set(eid, col);
    }
  }

  return { nodeIds, edgeIds, paths, edgeColors, nodePathColors };
}

export function getBreadcrumbAlternatives(nodeId: string, data: GraphData) {
  return getAllAscentPaths(nodeId, data).map((p) => ({
    rootId: p.rootId,
    color: pathColor(p.colorIndex),
    items: p.nodeIds.map((id) => {
      const n = data.nodes.find((x) => x.id === id);
      return { id, title: n?.title || 'Sans titre' };
    }),
  }));
}

export function hierarchyPair(
  edge: KnowledgeEdge,
  byId: Map<string, KnowledgeNode>,
  allEdges?: KnowledgeEdge[],
  ctx?: RelationContext
): { parentId: string; childId: string } | null {
  return pairFromEdge(edge, byId, allEdges, ctx);
}
