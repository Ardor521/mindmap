import type {
  GraphData,
  KnowledgeEdge,
  KnowledgeNode,
  EdgeStyle,
  RelationTypeDef,
  RelationTypeOverride,
} from './types';
import {
  defaultStyleForRelation,
  isHierarchyType,
  isHierarchicalRelation,
} from './types';

export const CHILD_SCALE_RATIO = 0.6;
/** Mindmap 2D: after this many father→son steps (parent depth), stop auto-shrinking */
export const MINDMAP_SHRINK_UNTIL_PARENT_DEPTH = 3;

export function childScale(parentScale: number): number {
  return Math.max(parentScale * CHILD_SCALE_RATIO, 1e-15);
}

/**
 * Hierarchical child scale.
 * 2D mindmap: shrink only while parent.depth < 3 (three enchaînements from root).
 * Beyond that, child keeps the same size as parent — unless user ±10% (scaleLocked).
 * 3D universe: always 60%.
 */
export function hierarchicalChildScale(
  parentScale: number,
  parentDepth: number,
  mapKind?: string | null
): number {
  if (mapKind === 'mindmap' && parentDepth >= MINDMAP_SHRINK_UNTIL_PARENT_DEPTH) {
    return Math.max(parentScale, 1e-15);
  }
  return childScale(parentScale);
}

export function strokeOf(edge: KnowledgeEdge): EdgeStyle {
  if (edge.style === 'dashed' || edge.style === 'dotted' || edge.style === 'solid') {
    return edge.style;
  }
  if ((edge as { dashed?: boolean }).dashed) return 'dashed';
  return 'solid';
}

/** Tirets fins only — excluded from hierarchy. */
export function isHierarchyStroke(edge: KnowledgeEdge): boolean {
  return strokeOf(edge) !== 'dotted';
}

function stripAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isRelatedType(type: string): boolean {
  const t = stripAccents(String(type)).replace(/[^a-z0-9]+/g, '_');
  return (
    t === 'related' ||
    t === 'relie' ||
    t === 'reliee' ||
    t === 'lie' ||
    t === 'liee' ||
    t === 'link' ||
    t === 'linked' ||
    t.startsWith('relie')
  );
}

function normKey(s: string): string {
  return stripAccents(s).replace(/[^a-z0-9]+/g, '_');
}

export type RelationContext = {
  customRelationTypes?: RelationTypeDef[] | null;
  relationOverrides?: Partial<Record<string, RelationTypeOverride>> | null;
  mapKind?: string | null;
};

function typeLabel(type: string, ctx?: RelationContext): string {
  const o = ctx?.relationOverrides?.[type];
  if (o?.label) return o.label;
  const c = ctx?.customRelationTypes?.find((t) => t.id === type);
  if (c?.label) return c.label;
  return type;
}

/**
 * Direction helpers from type id + label keywords.
 * Returns which endpoint is the child relative to the edge's source/target.
 *
 * childMeansTarget: source=parent, target=child (default for child/contient/example)
 * childMeansSource: source=child, target=parent (parent/depends_on/contenu_dans)
 */
function semanticChildEnd(
  type: string,
  ctx?: RelationContext
): 'target' | 'source' | 'undirected' {
  const id = normKey(type);
  const label = normKey(typeLabel(type, ctx));
  const blob = `${id} ${label}`;

  // Explicit builtins
  if (id === 'child' || id === 'enfant' || id === 'fils' || id === 'fille') return 'target';
  if (id === 'parent' || id === 'pere' || id === 'mere' || id === 'mere') return 'source';

  // Source is parent, target is child
  // contenue / contenu / contient / contains / includes / example / exemple
  if (
    /\b(child|enfant|fils|fille|sub|sous)\b/.test(blob) ||
    /\b(contient|contain|contains|include|includes|inclut)\b/.test(blob) ||
    /\b(contenue|contenu|contained)\b/.test(blob) ||
    /\b(example|exemple|instance|cas)\b/.test(blob) ||
    /\b(consequence|resultat|part_of_parent)\b/.test(blob)
  ) {
    // "contenu dans" / "contained in" → source is child
    if (
      /\b(contenu_dans|contained_in|dans|inside)\b/.test(blob) &&
      !/\b(contient|contains)\b/.test(blob)
    ) {
      return 'source';
    }
    // plain "contenue" / "contenu" as custom type name: user said MW is fils via contenue
    // → treat like child link: source=parent, target=child
    return 'target';
  }

  // Source is child, target is parent
  if (
    /\b(parent|pere|mere|mere|father|mother)\b/.test(blob) ||
    /\b(depends_on|depend|depend_de|requis|prerequisite|prerequis)\b/.test(blob) ||
    /\b(appartient|member_of|part_of)\b/.test(blob)
  ) {
    return 'source';
  }

  // cause: source causes target → source more "root"? keep undirected/scale
  // related
  if (isRelatedType(type)) return 'undirected';

  // Custom hierarchical flag without keywords → undirected (scale / multi)
  const custom = ctx?.customRelationTypes?.find((t) => t.id === type);
  if (custom?.hierarchical) return 'target';

  return 'undirected';
}

function edgeTouches(edge: KnowledgeEdge, nodeId: string): boolean {
  return edge.source === nodeId || edge.target === nodeId;
}

/** Non-related hierarchy strokes touching a node. */
function hasNonRelatedHierarchy(nodeId: string, allEdges: KnowledgeEdge[]): boolean {
  return allEdges.some(
    (e) =>
      edgeTouches(e, nodeId) &&
      isHierarchyStroke(e) &&
      !isRelatedType(String(e.type))
  );
}

/**
 * Does this edge count for hierarchy of `nodeId`?
 * - Tirets fins: never
 * - Non-relié: always
 * - Relié: only if the concept has NO other non-related hierarchy link
 */
export function edgeCountsForNode(
  edge: KnowledgeEdge,
  nodeId: string,
  allEdges: KnowledgeEdge[]
): boolean {
  if (!edgeTouches(edge, nodeId)) return false;
  if (!isHierarchyStroke(edge)) return false;
  if (!isRelatedType(String(edge.type))) return true;
  return !hasNonRelatedHierarchy(nodeId, allEdges);
}

export function isHierarchyEdge(
  edge: KnowledgeEdge,
  allEdges?: KnowledgeEdge[]
): boolean {
  if (!isHierarchyStroke(edge)) return false;
  if (!allEdges) return true;
  return (
    edgeCountsForNode(edge, edge.source, allEdges) ||
    edgeCountsForNode(edge, edge.target, allEdges)
  );
}

/**
 * Resolve parent/child for an edge (semantic types first, never trust broken scales).
 */
export function pairFromEdge(
  edge: KnowledgeEdge,
  nodesById: Map<string, KnowledgeNode>,
  allEdges?: KnowledgeEdge[],
  ctx?: RelationContext
): { parentId: string; childId: string } | null {
  if (edge.source === edge.target) return null;
  if (!isHierarchyStroke(edge)) return null;

  const a = nodesById.get(edge.source);
  const b = nodesById.get(edge.target);
  if (!a || !b) return null;

  const type = String(edge.type);

  // Related: handled specially by caller for related-only nodes
  if (isRelatedType(type)) {
    if (allEdges) {
      // Only valid when at least one end is related-only
      const aOnly = edgeCountsForNode(edge, a.id, allEdges);
      const bOnly = edgeCountsForNode(edge, b.id, allEdges);
      if (!aOnly && !bOnly) return null;
    }
    // Undirected for pairing — caller decides multi-parent for related-only child
    // Prefer larger as parent when both related-only or mixed
    if (b.scale > a.scale * 1.02) return { parentId: b.id, childId: a.id };
    if (a.scale > b.scale * 1.02) return { parentId: a.id, childId: b.id };
    // Equal: use depth if any, else source parent
    if (b.depth > a.depth) return { parentId: a.id, childId: b.id };
    if (a.depth > b.depth) return { parentId: b.id, childId: a.id };
    return { parentId: a.id, childId: b.id };
  }

  const end = semanticChildEnd(type, ctx);
  if (end === 'target') {
    return { parentId: edge.source, childId: edge.target };
  }
  if (end === 'source') {
    return { parentId: edge.target, childId: edge.source };
  }

  // Undirected: prefer existing parentId (stable), then depth, then large scale gaps only
  if (a.parentId === b.id) return { parentId: b.id, childId: a.id };
  if (b.parentId === a.id) return { parentId: a.id, childId: b.id };
  if (b.depth > a.depth + 0.5) return { parentId: a.id, childId: b.id };
  if (a.depth > b.depth + 0.5) return { parentId: b.id, childId: a.id };
  // Large scale gap only — avoid flip-flops from temporary aberrations
  if (b.scale > a.scale * 1.25) return { parentId: b.id, childId: a.id };
  if (a.scale > b.scale * 1.25) return { parentId: a.id, childId: b.id };
  return { parentId: a.id, childId: b.id };
}

/**
 * Build parent sets with correct related-only rules:
 * - Related-only node: EVERY related neighbor is a parent (node is always the child)
 * - Otherwise: ignore related; use semantic direction of other types
 */
export function buildHierarchyParents(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  ctx?: RelationContext
): Map<string, Set<string>> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentSets = new Map<string, Set<string>>();
  const add = (childId: string, parentId: string) => {
    if (childId === parentId) return;
    if (!byId.has(childId) || !byId.has(parentId)) return;
    if (!parentSets.has(childId)) parentSets.set(childId, new Set());
    parentSets.get(childId)!.add(parentId);
  };

  for (const n of nodes) {
    const touching = edges.filter(
      (e) => edgeTouches(e, n.id) && isHierarchyStroke(e)
    );
    const nonRelated = touching.filter((e) => !isRelatedType(String(e.type)));
    const relatedOnly = nonRelated.length === 0;

    if (relatedOnly) {
      // Only "relié" (or nothing): every related neighbor = parent folder
      for (const e of touching) {
        if (!isRelatedType(String(e.type))) continue;
        const other = e.source === n.id ? e.target : e.source;
        add(n.id, other);
      }
      continue;
    }

    // Has other types: ignore related completely for this node
    for (const e of nonRelated) {
      const pair = pairFromEdge(e, byId, edges, ctx);
      if (!pair) continue;
      if (pair.childId === n.id) add(n.id, pair.parentId);
      // If this node is parent on the edge, the other becomes child via their own pass
    }
  }

  // Break mutual parent cycles (A parent of B and B parent of A)
  for (const [childId, parents] of parentSets) {
    for (const p of [...parents]) {
      if (parentSets.get(p)?.has(childId)) {
        // Keep larger scale as parent of smaller
        const c = byId.get(childId)!;
        const par = byId.get(p)!;
        if (c.scale >= par.scale) {
          parents.delete(p); // child is bigger → remove this parent link
        } else {
          parentSets.get(p)?.delete(childId);
        }
      }
    }
  }

  return parentSets;
}

/**
 * Full graph normalization on every launch / edge change.
 * - All strokes except tirets fins
 * - Relié only if concept has no other types; then multi-parent average
 * - Semantic types (enfant, contenue, exemple, …) force direction
 * - Child scale = avg(parents) * 0.6
 */
export function normalizeHierarchyScales(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[] = [],
  ctx?: RelationContext
): KnowledgeNode[] {
  // ctx.mapKind used for 2D shrink-after-3-levels rule
  if (!nodes.length) return nodes;

  const result = nodes.map((n) => ({
    ...n,
    scale:
      typeof n.scale === 'number' && Number.isFinite(n.scale) && n.scale > 0
        ? n.scale
        : 1,
  }));
  const byId = new Map(result.map((n) => [n.id, n]));
  const edgeList = edges ?? [];

  const parentSets = buildHierarchyParents(result, edgeList, ctx);

  // Drop parentId if it only exists via tirets fins (no real hierarchy edge)
  for (const n of result) {
    if (!n.parentId || !byId.has(n.parentId)) {
      if (n.parentId && !byId.has(n.parentId)) n.parentId = undefined;
      continue;
    }
    const pid = n.parentId;
    const realLink = edgeList.some((e) => {
      if (!isHierarchyStroke(e)) return false;
      if (!edgeTouches(e, n.id) || !edgeTouches(e, pid)) return false;
      const pair = pairFromEdge(e, byId, edgeList, ctx);
      return pair?.childId === n.id && pair.parentId === pid;
    });
    if (!realLink) {
      // parentId stale or only dotted — clear; may be rebuilt from parentSets
      n.parentId = undefined;
    }
  }

  // Topological order from roots
  const inCount = new Map<string, number>();
  for (const n of result) inCount.set(n.id, 0);
  for (const [child, parents] of parentSets) {
    // filter missing
    const ok = [...parents].filter((p) => byId.has(p));
    parentSets.set(child, new Set(ok));
    inCount.set(child, ok.length);
  }

  // Cycle break: if still cyclic, drop edges to largest-scale nodes first
  const breakCycles = () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const stack: string[] = [];
    const drop: { child: string; parent: string }[] = [];

    const dfs = (id: string) => {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        // cycle — drop edge from previous stack node to id
        const idx = stack.indexOf(id);
        if (idx >= 0) {
          for (let i = idx; i < stack.length; i++) {
            const cur = stack[i];
            const next = stack[i + 1] ?? id;
            if (parentSets.get(next)?.has(cur)) {
              drop.push({ child: next, parent: cur });
            }
          }
        }
        return;
      }
      visiting.add(id);
      stack.push(id);
      for (const [child, parents] of parentSets) {
        if (parents.has(id)) dfs(child);
      }
      stack.pop();
      visiting.delete(id);
      done.add(id);
    };

    for (const n of result) dfs(n.id);
    for (const d of drop) {
      parentSets.get(d.child)?.delete(d.parent);
    }
  };
  breakCycles();

  // Recompute indegree
  for (const n of result) inCount.set(n.id, parentSets.get(n.id)?.size ?? 0);

  const queue = result.filter((n) => (inCount.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  const indeg = new Map(inCount);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const [child, parents] of parentSets) {
      if (!parents.has(id)) continue;
      const next = (indeg.get(child) ?? 1) - 1;
      indeg.set(child, next);
      if (next === 0) queue.push(child);
    }
  }
  // leftover cyclic nodes
  for (const n of result) {
    if (!order.includes(n.id)) order.push(n.id);
  }

  const oldPos = new Map(
    result.map((n) => [n.id, { x: n.x, y: n.y, scale: n.scale }])
  );

  // Assign primary parentId + scales (respect scaleLocked) + link distances
  for (const id of order) {
    const n = byId.get(id)!;
    const parents = [...(parentSets.get(id) ?? [])]
      .map((p) => byId.get(p)!)
      .filter(Boolean);

    if (!parents.length) {
      n.parentId = undefined;
      n.depth = 0;
      if (!Number.isFinite(n.scale) || n.scale <= 0) n.scale = 1;
      continue;
    }

    // Prefer existing valid parentId if still in candidates; else largest scale
    parents.sort((a, b) => b.scale - a.scale || a.title.localeCompare(b.title));
    const preferred =
      (n.parentId && parents.find((p) => p.id === n.parentId)) || parents[0];
    n.parentId = preferred.id;
    n.depth = Math.max(...parents.map((p) => (p.depth ?? 0) + 1));

    // Scale from hierarchy parents only (dotted never in parentSets)
    const avg =
      parents.reduce((s, p) => s + p.scale, 0) / Math.max(parents.length, 1);
    const parentDepth = Math.max(...parents.map((p) => p.depth ?? 0));
    const hierarchicalTarget = hierarchicalChildScale(
      avg,
      parentDepth,
      ctx?.mapKind
    );

    if (!n.scaleLocked) {
      n.scale = hierarchicalTarget;
    } else if (!Number.isFinite(n.scale) || n.scale <= 0) {
      n.scale = hierarchicalTarget;
    }
    // Keep x,y — do not reposition on normalize
    const oldKid = oldPos.get(id);
    if (oldKid) {
      n.x = oldKid.x;
      n.y = oldKid.y;
    }
  }

  // Homogenize unlocked siblings under the same parent
  const byParent = new Map<string, KnowledgeNode[]>();
  for (const n of result) {
    if (!n.parentId || !byId.has(n.parentId)) continue;
    if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
    byParent.get(n.parentId)!.push(n);
  }
  for (const [pid, kids] of byParent) {
    const parent = byId.get(pid);
    if (!parent || kids.length < 1) continue;
    const target = hierarchicalChildScale(
      parent.scale,
      parent.depth ?? 0,
      ctx?.mapKind
    );
    for (const kid of kids) {
      kid.depth = (parent.depth ?? 0) + 1;
      kid.parentId = pid;
      // ±10% (scaleLocked) is never overwritten
      if (!kid.scaleLocked) {
        kid.scale = target;
      }
    }
  }

  // Final root sanitize (nodes still without parent)
  const rootScales = result.filter((n) => !n.parentId).map((n) => n.scale);
  const median =
    rootScales.slice().sort((a, b) => a - b)[Math.floor(rootScales.length / 2)] ||
    1;
  for (const n of result) {
    if (!n.parentId) {
      if (n.scale > median * 1e6) n.scale = median * 100;
      if (n.scale < median / 1e6) n.scale = median / 100;
      n.depth = 0;
    }
    if (!Number.isFinite(n.scale) || n.scale <= 0) n.scale = 1;
  }

  return result;
}

/**
 * Normalize missing edge styles only.
 * Tirets fins are NEVER converted to solid — they stay excluded from hierarchy,
 * even if the type is « Enfant » (fixes giant parent via dotted-only links).
 */
export function sanitizeEdges(
  edges: KnowledgeEdge[],
  ctx?: RelationContext
): KnowledgeEdge[] {
  return edges.map((e) => {
    let style = e.style;
    if (style !== 'solid' && style !== 'dashed' && style !== 'dotted') {
      // Missing style: hierarchical types default solid; others use type default
      if (isHierarchicalRelation(e.type)) {
        style = 'solid';
      } else {
        style = defaultStyleForRelation(
          e.type,
          ctx?.customRelationTypes,
          ctx?.relationOverrides
        );
      }
      return { ...e, style };
    }
    return e;
  });
}

export type NormalizeOpts = {
  /** When true, force hierarchical scales (60% children). Default false on import. */
  forceScales?: boolean;
};

export function normalizeGraphData<T extends GraphData>(
  data: T,
  opts: NormalizeOpts = {}
): T {
  const ctx: RelationContext = {
    customRelationTypes: data.customRelationTypes,
    relationOverrides: data.relationOverrides,
    mapKind: data.mapKind,
  };
  const edges = sanitizeEdges(data.edges ?? [], ctx);

  // Soft (default): respect ONLY explicit scaleLocked (±10% utilisateur).
  // Ne JAMAIS verrouiller tous les nœuds juste parce qu'ils ont une scale —
  // sinon la hiérarchie (60 %) ne s'applique jamais (ex. « Naines »).
  // forceScales: déverrouille tout sauf les vrais verrous utilisateur déjà true.
  const inputNodes = data.nodes.map((n) => ({
    ...n,
    scaleLocked: opts.forceScales ? false : !!n.scaleLocked,
  }));

  const nodes = normalizeHierarchyScales(inputNodes, edges, ctx);

  return {
    ...data,
    edges,
    nodes,
  };
}

/**
 * ±10% / scale change: grow/shrink a node AND its whole descendant tree
 * (concept sizes + relative link lengths). Keeps hierarchy ratios inside the subtree.
 */
/**
 * ±10% : change ONLY concept scale(s). Never moves nodes (links stay put).
 * By default only the root id; pass cascade=true to scale descendant sizes too.
 */
export function scaleSubtree(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  rootId: string,
  factor: number,
  ctx?: RelationContext,
  cascade = false
): KnowledgeNode[] {
  if (!nodes.length || !Number.isFinite(factor) || factor <= 0) return nodes;
  const f = Math.min(Math.max(factor, 0.05), 20);
  const pivot = nodes.find((n) => n.id === rootId);
  if (!pivot) return nodes;

  const targets = new Set<string>([rootId]);
  if (cascade) {
    const parentSets = buildHierarchyParents(nodes, edges, ctx);
    const children = new Map<string, string[]>();
    for (const n of nodes) {
      if (n.parentId) {
        if (!children.has(n.parentId)) children.set(n.parentId, []);
        if (!children.get(n.parentId)!.includes(n.id)) children.get(n.parentId)!.push(n.id);
      }
    }
    for (const [child, parents] of parentSets) {
      for (const p of parents) {
        if (!children.has(p)) children.set(p, []);
        if (!children.get(p)!.includes(child)) children.get(p)!.push(child);
      }
    }
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      for (const c of children.get(id) || []) {
        if (!targets.has(c)) {
          targets.add(c);
          stack.push(c);
        }
      }
    }
  }

  return nodes.map((n) => {
    if (!targets.has(n.id)) return n;
    return {
      ...n,
      scale: Math.max(1e-15, n.scale * f),
      scaleLocked: true,
      // positions untouched
    };
  });
}

/** Set absolute scale on one node (size only). */
export function setNodeScaleCascaded(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  rootId: string,
  newScale: number,
  ctx?: RelationContext
): KnowledgeNode[] {
  const node = nodes.find((n) => n.id === rootId);
  if (!node) return nodes;
  const old = Math.max(node.scale, 1e-15);
  const target = Math.max(newScale, 1e-15);
  return scaleSubtree(nodes, edges, rootId, target / old, ctx, false);
}

export function placeChild(
  parent: KnowledgeNode,
  existingChildren: KnowledgeNode[],
  index: number
) {
  const count = Math.max(existingChildren.length + 1, 1);
  const step = (Math.PI * 2) / Math.max(count, 6);
  const a = index * step - Math.PI / 2;
  const baseR = 160 * parent.scale;
  return {
    x: parent.x + Math.cos(a) * (baseR + count * 10 * parent.scale),
    y: parent.y + Math.sin(a) * (baseR + count * 10 * parent.scale),
  };
}

export function findEmptySpot(
  nodes: KnowledgeNode[],
  nearX: number,
  nearY: number,
  radius = 160
) {
  if (nodes.length === 0) return { x: nearX, y: nearY };
  for (let attempt = 0; attempt < 48; attempt++) {
    const angle = (attempt / 48) * Math.PI * 2;
    const r = radius + Math.floor(attempt / 8) * 100;
    const x = nearX + Math.cos(angle) * r;
    const y = nearY + Math.sin(angle) * r;
    const collision = nodes.some((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 100 * Math.max(n.scale, 0.05);
    });
    if (!collision) return { x, y };
  }
  return { x: nearX + radius, y: nearY };
}

export function fitCameraToNodes(
  nodes: KnowledgeNode[],
  viewport: { width: number; height: number },
  padding = 0.15
) {
  if (!nodes.length) return { x: 0, y: 0, zoom: 1 };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    const r = 80 * Math.max(n.scale, 0.01);
    minX = Math.min(minX, n.x - r);
    maxX = Math.max(maxX, n.x + r);
    minY = Math.min(minY, n.y - r);
    maxY = Math.max(maxY, n.y + r);
  }
  const w = Math.max(maxX - minX, 100);
  const h = Math.max(maxY - minY, 100);
  const zoom = Math.min(
    (viewport.width * (1 - padding)) / w,
    (viewport.height * (1 - padding)) / h
  );
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    zoom: Math.max(Math.min(zoom, 4), 1e-12),
  };
}

export function refineLayout(
  nodes: KnowledgeNode[],
  _edges: KnowledgeEdge[],
  _iterations = 40
) {
  return nodes.map((n) => ({ ...n }));
}
