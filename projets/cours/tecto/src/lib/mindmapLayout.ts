
import type { GraphData, KnowledgeEdge } from './types';
import { buildParentIndex, hierarchyPair } from './paths';

export type ViewMode = 'universe' | 'mindmap';

/**
 * Classic planar mindmap layout (like a 2D mind map).
 * Does NOT mutate stored graph positions — returns display overrides.
 */
export function computeMindmapLayout(
  data: GraphData,
  opts?: { rootId?: string | null; width?: number; height?: number }
): Map<string, { x: number; y: number; scale: number }> {
  const out = new Map<string, { x: number; y: number; scale: number }>();
  if (!data.nodes.length) return out;

  const { parents, children, byId } = buildParentIndex(data);

  // Choose root: explicit, or largest scale among roots, or largest overall
  let rootId = opts?.rootId || null;
  if (rootId && !byId.has(rootId)) rootId = null;

  if (!rootId) {
    const roots = data.nodes.filter((n) => !(parents.get(n.id)?.length));
    const pool = roots.length ? roots : data.nodes;
    rootId = pool.slice().sort((a, b) => b.scale - a.scale || a.title.localeCompare(b.title))[0].id;
  }

  // Build tree downward from root (BFS), avoid cycles
  const treeChildren = new Map<string, string[]>();
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const kids = (children.get(id) || []).map((c) => c.childId);
    // also nodes with parentId
    for (const n of data.nodes) {
      if (n.parentId === id && !kids.includes(n.id)) kids.push(n.id);
    }
    const unique = [...new Set(kids)].filter((k) => !visited.has(k));
    treeChildren.set(id, unique);
    for (const k of unique) {
      visited.add(k);
      queue.push(k);
    }
  }

  // Orphan nodes (not under root) — attach as free satellites around
  const orphans = data.nodes.filter((n) => !visited.has(n.id));

  // Count leaves for radial span
  const leafCount = new Map<string, number>();
  const countLeaves = (id: string): number => {
    const kids = treeChildren.get(id) || [];
    if (!kids.length) {
      leafCount.set(id, 1);
      return 1;
    }
    let s = 0;
    for (const k of kids) s += countLeaves(k);
    leafCount.set(id, Math.max(s, 1));
    return leafCount.get(id)!;
  };
  countLeaves(rootId);

  const levelGap = 200;

  // Radial layout: root at center, children in full circle
  const place = (id: string, depth: number, angleStart: number, angleEnd: number) => {
    const mid = (angleStart + angleEnd) / 2;
    const r = depth === 0 ? 0 : levelGap * depth + depth * 30;
    const x = Math.cos(mid) * r;
    const y = Math.sin(mid) * r;
    // Flat mindmap: scale decreases mildly with depth but stays readable
    const scale = Math.max(0.35, 1 - depth * 0.12);
    out.set(id, { x, y, scale });

    const kids = treeChildren.get(id) || [];
    if (!kids.length) return;
    const total = kids.reduce((s, k) => s + (leafCount.get(k) || 1), 0);
    let cursor = angleStart;
    const span = angleEnd - angleStart;
    for (const k of kids) {
      const w = (leafCount.get(k) || 1) / total;
      const next = cursor + span * w;
      place(k, depth + 1, cursor, next);
      cursor = next;
    }
  };

  // Full circle for root children
  place(rootId, 0, -Math.PI, Math.PI);

  // Place orphans in an outer ring
  if (orphans.length) {
    const R = levelGap * (1 + Math.max(...[...out.values()].map(() => 0), 0) + 3) + 280;
    orphans.forEach((n, i) => {
      const a = (i / orphans.length) * Math.PI * 2 - Math.PI / 2;
      out.set(n.id, {
        x: Math.cos(a) * R,
        y: Math.sin(a) * R,
        scale: 0.45,
      });
    });
  }

  // Ensure every node has a position
  for (const n of data.nodes) {
    if (!out.has(n.id)) {
      out.set(n.id, { x: n.x, y: n.y, scale: Math.min(n.scale, 0.8) });
    }
  }

  return out;
}

/** Edges to draw in mindmap: hierarchy edges within layout + optional others faded */
export function mindmapEdges(data: GraphData): KnowledgeEdge[] {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  return data.edges.filter((e) => hierarchyPair(e, byId, data.edges) != null);
}
