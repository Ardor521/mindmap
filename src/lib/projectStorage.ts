import type { GraphData } from './types';
import { createEmptyGraph } from '../data/seedGraph';
import { sanitizeEdges } from './layout';

export const PROJECT_FILE_VERSION = 3;

export interface ProjectFile {
  version: number;
  savedAt: string;
  app: 'knowledge-universe';
  project: GraphData;
}

export function toProjectFile(graph: GraphData): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    savedAt: new Date().toISOString(),
    app: 'knowledge-universe',
    project: {
      projectName: graph.projectName ?? 'Mon univers',
      mapKind: graph.mapKind === 'mindmap' ? 'mindmap' : 'universe',
      nodes: graph.nodes,
      edges: graph.edges,
      customColors: graph.customColors ?? [],
      relationColors: graph.relationColors ?? {},
      relationOverrides: graph.relationOverrides ?? {},
      customRelationTypes: graph.customRelationTypes ?? [],
      favoriteIcons: graph.favoriteIcons ?? [],
      legendSize: graph.legendSize,
      conceptLegendSize: graph.conceptLegendSize,
      defaultLinkFontSize: graph.defaultLinkFontSize ?? 12,
      defaultNodeColor: graph.defaultNodeColor ?? null,
      colorGroupLabels: graph.colorGroupLabels ?? {},
    },
  };
}

export function serializeProject(graph: GraphData): string {
  return JSON.stringify(toProjectFile(graph), null, 2);
}

function normalizeProject(g: GraphData): GraphData {
  const empty = createEmptyGraph();
  const overrides = { ...(g.relationOverrides ?? {}) };
  if (g.relationColors) {
    for (const [k, v] of Object.entries(g.relationColors)) {
      if (!v) continue;
      overrides[k] = { ...(overrides[k] ?? {}), color: v };
    }
  }
  const edgesRaw = g.edges ?? [];
  // Preserve saved layout: keep x,y,scale,depth,parentId exactly as stored.
  // Old files (e.g. knowledge-universe.json) had no scaleLocked but custom scales (1.6 vs 1.32)
  // -> treat saved scale as intentional and freeze it (scaleLocked = true) on import.
  const nodesRaw = (g.nodes ?? []).map((n) => ({
    ...n,
    isPrimary: !!n.isPrimary,
    scale: typeof n.scale === 'number' && n.scale > 0 && Number.isFinite(n.scale) ? n.scale : 1,
    // Preserve manual layout: lock every imported node so hierarchy 60% does not shrink it on reload.
    // If file already has an explicit scaleLocked, keep it; otherwise lock (true) to freeze saved size.
    scaleLocked: n.scaleLocked ?? true,
    wFactor:
      typeof n.wFactor === 'number' && n.wFactor > 0 ? Math.min(3, Math.max(0.4, n.wFactor)) : 1,
    hFactor:
      typeof n.hFactor === 'number' && n.hFactor > 0 ? Math.min(3, Math.max(0.4, n.hFactor)) : 1,
  }));
  const base = {
    ...empty,
    ...g,
    nodes: nodesRaw,
    edges: edgesRaw,
    projectName: g.projectName ?? empty.projectName,
    mapKind: g.mapKind === 'mindmap' ? ('mindmap' as const) : ('universe' as const),
    customColors: g.customColors ?? [],
    relationColors: g.relationColors ?? {},
    relationOverrides: overrides,
    customRelationTypes: g.customRelationTypes ?? [],
    favoriteIcons: g.favoriteIcons ?? empty.favoriteIcons ?? [],
    legendSize: g.legendSize ?? empty.legendSize,
    conceptLegendSize: g.conceptLegendSize ?? empty.conceptLegendSize,
    defaultLinkFontSize: g.defaultLinkFontSize ?? empty.defaultLinkFontSize ?? 12,
    defaultNodeColor: (g as any).defaultNodeColor ?? null,
    colorGroupLabels: g.colorGroupLabels ?? {},
  };
  // Only sanitize edge styles — do NOT recompute hierarchy scales/depth/parentId.
  // This keeps the saved positions and manual sizes 100% intact (fix for "mise en place complètement changée").
  const ctx = {
    customRelationTypes: base.customRelationTypes,
    relationOverrides: base.relationOverrides,
    mapKind: base.mapKind,
  };
  const edges = sanitizeEdges(base.edges ?? [], ctx);
  // Drop invalid parentId only (orphan), otherwise keep as saved
  const byId = new Set(nodesRaw.map((n) => n.id));
  const nodes = nodesRaw.map((n) => (n.parentId && !byId.has(n.parentId) ? { ...n, parentId: undefined } : n));
  return {
    ...base,
    edges,
    nodes,
  };
}

export function parseProject(raw: string): GraphData | null {
  try {
    const data = JSON.parse(raw) as ProjectFile | GraphData;
    if (data && typeof data === 'object' && 'project' in data && (data as ProjectFile).project) {
      const p = (data as ProjectFile).project;
      if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;
      return normalizeProject(p);
    }
    const g = data as GraphData;
    if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
    return normalizeProject(g);
  } catch { return null; }
}

export interface WorkspaceBundle {
  version: number;
  app: 'knowledge-universe';
  savedAt: string;
  workspaces: { id: string; name: string; project: GraphData }[];
}

export function serializeWorkspaceBundle(items: { id: string; name: string; graph: GraphData }[]): string {
  const bundle: WorkspaceBundle = {
    version: PROJECT_FILE_VERSION, app: 'knowledge-universe', savedAt: new Date().toISOString(),
    workspaces: items.map((w) => ({ id: w.id, name: w.name, project: toProjectFile(w.graph).project })),
  };
  return JSON.stringify(bundle, null, 2);
}

export function parseWorkspaceBundle(raw: string): { id: string; name: string; graph: GraphData }[] | null {
  try {
    const data = JSON.parse(raw) as WorkspaceBundle | ProjectFile | GraphData;
    if (data && typeof data === 'object' && 'workspaces' in data && Array.isArray((data as WorkspaceBundle).workspaces)) {
      return (data as WorkspaceBundle).workspaces.map((w, i) => ({
        id: w.id || `ws-import-${i}`, name: w.name || `Espace ${i + 1}`, graph: normalizeProject(w.project),
      }));
    }
    const single = parseProject(raw);
    if (!single) return null;
    return [{ id: `ws-import-${Date.now()}`, name: single.projectName || 'Import', graph: single }];
  } catch { return null; }
}

/**
 * Fusionne 2 graphes dans le même espace (même workspace) sans perdre de données.
 * - Les IDs en collision sont réécrits
 * - Les positions du `incoming` sont décalées à droite pour éviter le chevauchement
 * - Supporte colorSegments (division multicolore) et toutes les métadonnées
 */
export function mergeGraphs(base: GraphData, incoming: GraphData): GraphData {
  if (!incoming.nodes.length) return { ...base };
  if (!base.nodes.length) {
    // Base vide → on prend incoming tel quel (avec son projectName si base n'en a pas)
    return {
      ...incoming,
      projectName: base.projectName || incoming.projectName,
      customColors: [...new Set([...(base.customColors ?? []), ...(incoming.customColors ?? [])])],
    };
  }

  const baseIds = new Set(base.nodes.map((n) => n.id));
  const baseEdgeIds = new Set(base.edges.map((e) => e.id));

  // Bornes pour offset
  let baseMaxX = -Infinity, baseMinY = Infinity, baseMaxY = -Infinity;
  for (const n of base.nodes) {
    if (n.x > baseMaxX) baseMaxX = n.x;
    if (n.y < baseMinY) baseMinY = n.y;
    if (n.y > baseMaxY) baseMaxY = n.y;
  }
  let incMinX = Infinity, incMinY = Infinity, incMaxY = -Infinity;
  for (const n of incoming.nodes) {
    if (n.x < incMinX) incMinX = n.x;
    if (n.y < incMinY) incMinY = n.y;
    if (n.y > incMaxY) incMaxY = n.y;
  }
  // Décalage horizontal : à droite de la base + marge dépendante de l'échelle moyenne
  const avgScale = base.nodes.reduce((s, n) => s + n.scale, 0) / Math.max(1, base.nodes.length);
  const gap = Math.max(400, 200 * avgScale);
  const offsetX = baseMaxX - incMinX + gap;
  // Centrage vertical approximatif
  const baseCenterY = (baseMinY + baseMaxY) / 2;
  const incCenterY = (incMinY + incMaxY) / 2;
  const offsetY = baseCenterY - incCenterY;

  const idMap = new Map<string, string>();
  const newNodes = incoming.nodes.map((n, idx) => {
    let newId = n.id;
    if (baseIds.has(newId)) {
      // Collision → nouvel ID unique
      newId = `${n.id}__merged_${Date.now()}_${idx}`;
      let k = 0;
      while (baseIds.has(newId) || Array.from(idMap.values()).includes(newId)) {
        newId = `${n.id}__merged_${Date.now()}_${idx}_${k++}`;
      }
    }
    idMap.set(n.id, newId);
    return { n, newId };
  });

  // Construit la map finale old -> new (incluant non-collision)
  for (const n of incoming.nodes) {
    if (!idMap.has(n.id)) idMap.set(n.id, n.id);
  }

  const mappedNodes = newNodes.map(({ n, newId }) => {
    const mappedParent = n.parentId ? (idMap.get(n.parentId) ?? n.parentId) : undefined;
    // Si parentId pointe vers base et que ce parent n'existe pas dans incoming mais existe dans base, on le garde
    // Sinon si parentId était remappé, on utilise le nouveau
    return {
      ...n,
      id: newId,
      x: n.x + offsetX,
      y: n.y + offsetY,
      parentId: mappedParent,
    };
  });

  const incomingEdgeIdSet = new Set(incoming.edges.map((e) => e.id));
  const mappedEdges = incoming.edges.map((e, idx) => {
    let newId = e.id;
    if (baseEdgeIds.has(newId) || incomingEdgeIdSet.has(newId) && incoming.edges.indexOf(e) !== idx) {
      newId = `${e.id}__merged_${Date.now()}_${idx}`;
      while (baseEdgeIds.has(newId)) newId += '_';
    }
    const src = idMap.get(e.source) ?? e.source;
    const tgt = idMap.get(e.target) ?? e.target;
    return { ...e, id: newId, source: src, target: tgt };
  });

  // Fusion des métadonnées d'espace
  const mergedCustomColors = [...new Set([...(base.customColors ?? []), ...(incoming.customColors ?? [])])];
  const mergedRelationColors = { ...(base.relationColors ?? {}), ...(incoming.relationColors ?? {}) } as GraphData['relationColors'];
  const mergedOverrides = { ...(base.relationOverrides ?? {}), ...(incoming.relationOverrides ?? {}) } as GraphData['relationOverrides'];
  // customRelationTypes : union par id
  const typeMap = new Map<string, NonNullable<GraphData['customRelationTypes']>[number]>();
  for (const t of (base.customRelationTypes ?? [])) typeMap.set(t.id, t);
  for (const t of (incoming.customRelationTypes ?? [])) if (!typeMap.has(t.id)) typeMap.set(t.id, t as any);
  const mergedTypes = [...typeMap.values()] as GraphData['customRelationTypes'];

  return {
    ...base,
    nodes: [...base.nodes, ...mappedNodes],
    edges: [...base.edges, ...mappedEdges],
    customColors: mergedCustomColors,
    relationColors: mergedRelationColors,
    relationOverrides: mergedOverrides,
    customRelationTypes: mergedTypes,
    favoriteIcons: [...new Set([...(base.favoriteIcons ?? []), ...(incoming.favoriteIcons ?? [])])],
    // Garde defaultNodeColor / legendSize de la base (espace cible)
  };
}

/** Fusionne N graphes séquentiellement dans le même espace */
export function mergeMultipleGraphs(base: GraphData, incomings: GraphData[]): GraphData {
  let cur = base;
  for (const g of incomings) cur = mergeGraphs(cur, g);
  return cur;
}
