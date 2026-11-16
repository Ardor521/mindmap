import type { GraphData, KnowledgeEdge, KnowledgeNode, RelationType } from './types';
import { isHierarchicalRelation } from './types';
import { isHierarchyStroke } from './layout';

export function getPeerNeighbors(nodeIds: string[], graph: GraphData) {
  const idSet = new Set(nodeIds);
  const map = new Map<string, { node: KnowledgeNode; edgeType: RelationType }[]>();
  for (const id of nodeIds) {
    const list: { node: KnowledgeNode; edgeType: RelationType }[] = [];
    for (const e of graph.edges) {
      if (isHierarchicalRelation(e.type)) continue;
      if (e.source === id && !idSet.has(e.target)) {
        const n = graph.nodes.find((x) => x.id === e.target);
        if (n) list.push({ node: n, edgeType: e.type });
      } else if (e.target === id && !idSet.has(e.source)) {
        const n = graph.nodes.find((x) => x.id === e.source);
        if (n) list.push({ node: n, edgeType: e.type });
      }
    }
    map.set(id, list);
  }
  return map;
}

export function suggestPeerBridges(nodeIds: string[], graph: GraphData) {
  const neighbors = getPeerNeighbors(nodeIds, graph);
  const bridges: { source: string; target: string; type: RelationType }[] = [];
  const seen = new Set<string>();
  for (const id of nodeIds) {
    const neigh = neighbors.get(id) || [];
    for (let i = 0; i < neigh.length; i++) {
      for (let j = i + 1; j < neigh.length; j++) {
        const a = neigh[i].node.id,
          b = neigh[j].node.id;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seen.has(key)) continue;
        const exists = graph.edges.some(
          (e) =>
            !isHierarchicalRelation(e.type) &&
            ((e.source === a && e.target === b) ||
              (e.source === b && e.target === a))
        );
        if (exists) continue;
        seen.add(key);
        bridges.push({ source: a, target: b, type: 'related' });
      }
    }
  }
  return bridges;
}

/**
 * Delete nodes without reshaping the map:
 * - keep all remaining node positions
 * - keep all remaining scales (no homogenize / no inflate)
 * - only rewire parentId for orphans
 * - optional peer bridges from the dialog
 */
export function deleteNodesSmart(
  state: GraphData,
  ids: string[],
  peerBridges: KnowledgeEdge[] = []
): GraphData {
  const idSet = new Set(ids);
  let nodes = state.nodes.map((n) => ({ ...n }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const hierarchyBridges: KnowledgeEdge[] = [];

  for (const delId of ids) {
    const del = nodeById.get(delId);
    if (!del) continue;
    let parentId = del.parentId;
    while (parentId && idSet.has(parentId)) {
      parentId = nodeById.get(parentId)?.parentId;
    }
    const parent = parentId ? nodeById.get(parentId) : undefined;
    const children = nodes.filter(
      (n) => n.parentId === delId && !idSet.has(n.id)
    );
    for (const child of children) {
      // Keep child's scale and position — only update parent link / depth
      child.parentId = parentId;
      if (parent) {
        child.depth = (parent.depth ?? 0) + 1;
        hierarchyBridges.push({
          id: `e-${parent.id}-${child.id}-child-reparent`,
          source: parent.id,
          target: child.id,
          type: 'child',
          style: 'solid',
        });
      } else {
        child.depth = Math.max(0, (child.depth ?? 1) - 1);
      }
    }
  }

  nodes = nodes.filter((n) => !idSet.has(n.id));

  // Drop edges touching deleted nodes
  let edges = state.edges.filter(
    (e) => !idSet.has(e.source) && !idSet.has(e.target)
  );

  const edgeKey = (e: KnowledgeEdge) => {
    const a = e.source < e.target ? e.source : e.target;
    const b = e.source < e.target ? e.target : e.source;
    return `${a}|${b}|${e.type}`;
  };
  const existing = new Set(edges.map(edgeKey));

  for (const b of [...hierarchyBridges, ...peerBridges]) {
    if (idSet.has(b.source) || idSet.has(b.target)) continue;
    if (
      !nodes.some((n) => n.id === b.source) ||
      !nodes.some((n) => n.id === b.target)
    )
      continue;
    const key = edgeKey(b);
    if (existing.has(key)) continue;
    existing.add(key);
    edges.push(b);
  }

  // Clear dangling parentIds
  const alive = new Set(nodes.map((n) => n.id));
  nodes = nodes.map((n) =>
    n.parentId && !alive.has(n.parentId) ? { ...n, parentId: undefined } : n
  );

  return { ...state, nodes, edges };
}
