import type { GraphData, KnowledgeEdge, KnowledgeNode } from '../lib/types';
import { createEmptyGraph } from './seedGraph';
import { createFeatureGuideMindmap } from './featureGuideMindmap';

export type MindmapPatternId =
  | 'empty'
  | 'timeline'
  | 'hub'
  | 'columns'
  | 'swimlanes'
  | 'feature-guide';

export interface MindmapPatternMeta {
  id: MindmapPatternId;
  name: string;
  description: string;
  /** accent for UI */
  accent: string;
}

export const MINDMAP_PATTERNS: MindmapPatternMeta[] = [
  {
    id: 'empty',
    name: 'Libre',
    description: 'Mindmap vide — placez vos concepts librement.',
    accent: '#22d3ee',
  },
  {
    id: 'timeline',
    name: 'Chronologie',
    description:
      'Ligne horizontale de concepts tous à la même taille (échelle du premier) — idéal pour une frise temporelle.',
    accent: '#fbbf24',
  },
  {
    id: 'hub',
    name: 'Étoile / hub',
    description: 'Un centre et des rayons — brainstorming autour d’un thème.',
    accent: '#a78bfa',
  },
  {
    id: 'columns',
    name: 'Colonnes',
    description: 'Plusieurs piliers côte à côte (thèmes, catégories), taille égale.',
    accent: '#f472b6',
  },
  {
    id: 'swimlanes',
    name: 'Bandes parallèles',
    description: '2–3 lignes horizontales de même taille (parcours parallèles, scénarios).',
    accent: '#4ade80',
  },
  {
    id: 'feature-guide',
    name: 'Guide des fonctionnalités',
    description: 'Mindmap pédagogique 2D / 3D · Concepts & Liens.',
    accent: '#f59e0b',
  },
];

function node(
  id: string,
  title: string,
  description: string,
  x: number,
  y: number,
  opts: Partial<KnowledgeNode> & { color: string; depth?: number; scale?: number }
): KnowledgeNode {
  return {
    id,
    title,
    description,
    x,
    y,
    color: opts.color,
    icon: opts.icon ?? 'circle',
    tags: opts.tags ?? [],
    notes: opts.notes ?? '',
    resources: opts.resources ?? [],
    metadata: { pattern: 'true', ...(opts.metadata ?? {}) },
    depth: opts.depth ?? 0,
    scale: opts.scale ?? 1,
    parentId: opts.parentId,
    isPrimary: opts.isPrimary,
    scaleLocked: opts.scaleLocked ?? true,
    wFactor: opts.wFactor ?? 1.15,
    hFactor: opts.hFactor ?? 0.9,
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  type: KnowledgeEdge['type'] = 'related',
  style: KnowledgeEdge['style'] = 'solid',
  label?: string
): KnowledgeEdge {
  return { id, source, target, type, style, label };
}

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
];

/** Chronologie : une seule ligne, tous à l’échelle du premier (1). */
export function createTimelinePattern(steps = 7): GraphData {
  const base = createEmptyGraph('mindmap');
  const gap = 280;
  const labels = [
    'Début',
    'Étape 2',
    'Étape 3',
    'Étape 4',
    'Étape 5',
    'Étape 6',
    'Aujourd’hui',
    'Suite',
    'Horizon',
  ];
  const n = Math.min(Math.max(steps, 3), labels.length);
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];

  for (let i = 0; i < n; i++) {
    const id = `tl-${i}`;
    nodes.push(
      node(
        id,
        labels[i] || `Étape ${i + 1}`,
        i === 0
          ? 'Premier concept de la frise — tous les autres ont la même taille. Renommez, ajoutez des dates dans la description.'
          : 'Même échelle que le premier. Reliez en séquence (ou ajoutez des liens « Relié »). ±10 % si vous voulez une exception.',
        (i - (n - 1) / 2) * gap,
        0,
        {
          color: COLORS[i % COLORS.length],
          depth: 0,
          scale: 1,
          scaleLocked: true,
          isPrimary: i === 0,
          icon: i === 0 ? 'sparkles' : 'circle',
          tags: ['chronologie', i === 0 ? 'début' : 'étape'],
          wFactor: 1.25,
          hFactor: 0.85,
        }
      )
    );
    if (i > 0) {
      edges.push(
        edge(
          `e-tl-${i - 1}-${i}`,
          `tl-${i - 1}`,
          id,
          'related',
          'solid',
          'puis'
        )
      );
    }
  }

  // Axe décoratif optionnel : nœud légende au-dessus du milieu
  nodes.push(
    node(
      'tl-axis',
      'Frise (même taille)',
      'Motif chronologie 2D : ligne entière à l’échelle du premier concept. Idéal pour dates, versions, chapitres.',
      0,
      -200,
      {
        color: '#fbbf24',
        depth: 0,
        scale: 1,
        scaleLocked: true,
        icon: 'timer',
        tags: ['motif', 'aide'],
        wFactor: 1.6,
        hFactor: 0.75,
      }
    )
  );
  edges.push(edge('e-tl-axis', 'tl-axis', 'tl-0', 'related', 'dashed', 'légende'));

  return {
    ...base,
    projectName: 'Chronologie',
    mapKind: 'mindmap',
    nodes,
    edges,
    favoriteIcons: ['timer', 'circle', 'sparkles', 'flag'],
  };
}

/** Hub : centre + satellites même taille (pas de réduction). */
export function createHubPattern(rays = 6): GraphData {
  const base = createEmptyGraph('mindmap');
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const R = 340;
  nodes.push(
    node('hub-c', 'Thème central', 'Cœur de la carte. Les branches partent d’ici, même taille pour un brainstorming plat.', 0, 0, {
      color: '#a78bfa',
      depth: 0,
      scale: 1,
      scaleLocked: true,
      isPrimary: true,
      icon: 'sparkles',
      tags: ['hub', 'centre'],
      wFactor: 1.35,
    })
  );
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 - Math.PI / 2;
    const id = `hub-r-${i}`;
    nodes.push(
      node(
        id,
        `Idée ${i + 1}`,
        'Satellite du hub — même échelle que le centre (pas de réduction auto).',
        Math.cos(a) * R,
        Math.sin(a) * R,
        {
          color: COLORS[(i + 2) % COLORS.length],
          depth: 0,
          scale: 1,
          scaleLocked: true,
          icon: 'circle',
          tags: ['hub', 'branche'],
        }
      )
    );
    edges.push(edge(`e-hub-${i}`, 'hub-c', id, 'related', 'solid'));
  }
  return {
    ...base,
    projectName: 'Brainstorming étoile',
    mapKind: 'mindmap',
    nodes,
    edges,
  };
}

/** Colonnes / piliers de même taille. */
export function createColumnsPattern(cols = 4): GraphData {
  const base = createEmptyGraph('mindmap');
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const gap = 320;
  const titles = ['Pilier A', 'Pilier B', 'Pilier C', 'Pilier D', 'Pilier E'];
  const n = Math.min(Math.max(cols, 2), titles.length);

  nodes.push(
    node(
      'col-title',
      'Colonnes',
      'Chaque colonne est un concept racine de même taille. Ajoutez des fils sous chaque pilier si besoin.',
      0,
      -220,
      {
        color: '#f472b6',
        depth: 0,
        scale: 1,
        scaleLocked: true,
        icon: 'layout',
        tags: ['colonnes'],
        wFactor: 1.4,
        hFactor: 0.8,
      }
    )
  );

  for (let i = 0; i < n; i++) {
    const id = `col-${i}`;
    const x = (i - (n - 1) / 2) * gap;
    nodes.push(
      node(id, titles[i], 'Colonne / catégorie — même taille que les autres piliers.', x, 80, {
        color: COLORS[i % COLORS.length],
        depth: 0,
        scale: 1,
        scaleLocked: true,
        isPrimary: i === 0,
        icon: 'box',
        tags: ['colonne'],
        wFactor: 1.2,
      })
    );
    edges.push(edge(`e-col-t-${i}`, 'col-title', id, 'related', 'dashed'));
    // sample child under first two columns (will be 60% in hierarchy if unlocked — lock equal for flat board)
    if (i < 2) {
      const cid = `col-${i}-item`;
      nodes.push(
        node(cid, 'Élément', 'Exemple sous le pilier (taille réduite classique si vous déverrouillez l’échelle).', x, 280, {
          color: COLORS[i % COLORS.length],
          depth: 1,
          scale: 0.6,
          scaleLocked: true,
          parentId: id,
          icon: 'circle',
          tags: ['élément'],
        })
      );
      edges.push(edge(`e-col-${i}-c`, id, cid, 'child', 'solid'));
    }
  }

  return {
    ...base,
    projectName: 'Colonnes',
    mapKind: 'mindmap',
    nodes,
    edges,
  };
}

/** Bandes parallèles (swimlanes) — plusieurs chronologies. */
export function createSwimlanesPattern(lanes = 3, steps = 5): GraphData {
  const base = createEmptyGraph('mindmap');
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const laneNames = ['Parcours A', 'Parcours B', 'Parcours C', 'Parcours D'];
  const L = Math.min(Math.max(lanes, 2), laneNames.length);
  const S = Math.min(Math.max(steps, 3), 8);
  const gapX = 260;
  const gapY = 240;

  nodes.push(
    node(
      'sw-title',
      'Bandes parallèles',
      'Plusieurs lignes de concepts tous à la taille du premier de chaque bande — scénarios ou équipes en parallèle.',
      0,
      -((L - 1) * gapY) / 2 - 200,
      {
        color: '#4ade80',
        depth: 0,
        scale: 1,
        scaleLocked: true,
        icon: 'layers',
        tags: ['bandes'],
        wFactor: 1.5,
        hFactor: 0.75,
      }
    )
  );

  for (let li = 0; li < L; li++) {
    const y = (li - (L - 1) / 2) * gapY;
    const laneId = `sw-lane-${li}`;
    nodes.push(
      node(laneId, laneNames[li], 'Étiquette de bande (même taille que les étapes).', -((S - 1) / 2) * gapX - 280, y, {
        color: COLORS[(li + 3) % COLORS.length],
        depth: 0,
        scale: 1,
        scaleLocked: true,
        icon: 'flag',
        tags: ['bande'],
        wFactor: 1.2,
      })
    );
    edges.push(edge(`e-sw-t-${li}`, 'sw-title', laneId, 'related', 'dotted'));

    for (let si = 0; si < S; si++) {
      const id = `sw-${li}-${si}`;
      const x = (si - (S - 1) / 2) * gapX;
      nodes.push(
        node(
          id,
          si === 0 ? 'Début' : si === S - 1 ? 'Fin' : `J+${si}`,
          'Étape de la bande — même échelle que le premier de la ligne.',
          x,
          y,
          {
            color: COLORS[(li + si) % COLORS.length],
            depth: 0,
            scale: 1,
            scaleLocked: true,
            icon: 'circle',
            tags: ['chronologie', laneNames[li]],
            wFactor: 1.1,
            hFactor: 0.85,
          }
        )
      );
      if (si === 0) {
        edges.push(edge(`e-sw-l-${li}`, laneId, id, 'related', 'solid'));
      } else {
        edges.push(
          edge(`e-sw-${li}-${si - 1}-${si}`, `sw-${li}-${si - 1}`, id, 'related', 'solid', 'puis')
        );
      }
    }
  }

  return {
    ...base,
    projectName: 'Bandes parallèles',
    mapKind: 'mindmap',
    nodes,
    edges,
    favoriteIcons: ['layers', 'flag', 'timer', 'circle'],
  };
}

export function createMindmapFromPattern(id: MindmapPatternId): GraphData {
  switch (id) {
    case 'timeline':
      return createTimelinePattern(7);
    case 'hub':
      return createHubPattern(6);
    case 'columns':
      return createColumnsPattern(4);
    case 'swimlanes':
      return createSwimlanesPattern(3, 5);
    case 'feature-guide':
      return createFeatureGuideMindmap();
    case 'empty':
    default:
      return createEmptyGraph('mindmap');
  }
}

/** Detect a horizontal timeline chain (related/solid sequence, similar Y). */
export function detectTimelineRoots(graph: GraphData): KnowledgeNode[] {
  const nodes = graph.nodes;
  if (nodes.length < 2) return [];

  // Prefer nodes tagged chronologie or on a related-chain with similar Y
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    if (e.style === 'dotted') continue;
    // timeline uses related or sequential links between roots (no parentId)
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b) continue;
    const bothRoots = !a.parentId && !b.parentId;
    if (!bothRoots && e.type !== 'related') continue;
    if (Math.abs(a.y - b.y) > Math.max(80, 40 * Math.max(a.scale, b.scale))) continue;
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }

  // Find longest path-like chain among roots with degree <= 2
  const roots = nodes.filter((n) => !n.parentId || n.tags?.includes('chronologie'));
  const scored = roots
    .filter((n) => (adj.get(n.id)?.length ?? 0) > 0 || n.tags?.includes('chronologie'))
    .slice()
    .sort((a, b) => a.x - b.x);

  if (scored.length >= 2) {
    // Group by similar Y bands
    const bands: KnowledgeNode[][] = [];
    for (const n of scored) {
      let band = bands.find(
        (g) => Math.abs(g[0].y - n.y) < Math.max(60, 30 * n.scale)
      );
      if (!band) {
        band = [];
        bands.push(band);
      }
      band.push(n);
    }
    bands.sort((a, b) => b.length - a.length);
    const best = (bands[0] || []).slice().sort((a, b) => a.x - b.x);
    if (best.length >= 2) return best;
  }

  // Fallback: any roots sorted by X on similar Y as primary selection
  const free = nodes.filter((n) => !n.parentId).slice().sort((a, b) => a.x - b.x);
  return free.length >= 2 ? free : [];
}

export function isTimelineGraph(graph: GraphData): boolean {
  if (graph.mapKind !== 'mindmap') return false;
  if (graph.projectName?.toLowerCase().includes('chrono')) return true;
  if (graph.nodes.some((n) => n.tags?.includes('chronologie'))) return true;
  return detectTimelineRoots(graph).length >= 3;
}

/**
 * Append a new root concept on the timeline line, same scale as the first step.
 * Returns the new node fields + edge to previous last.
 */
export function buildChronologicalStep(graph: GraphData): {
  node: KnowledgeNode;
  edge: KnowledgeEdge;
} | null {
  const chain = detectTimelineRoots(graph);
  const refs = chain.length
    ? chain
    : graph.nodes.filter((n) => !n.parentId).slice().sort((a, b) => a.x - b.x);
  if (!refs.length) return null;

  const first = refs[0];
  const last = refs[refs.length - 1];
  const scale = first.scale > 0 ? first.scale : 1;
  const gap =
    refs.length >= 2
      ? Math.max(200, Math.abs(refs[1].x - refs[0].x))
      : 280;
  const y =
    refs.reduce((s, n) => s + n.y, 0) / refs.length;

  const id = `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const node: KnowledgeNode = {
    id,
    title: '',
    description: 'Nouvelle étape — même taille que le premier de la frise.',
    x: last.x + gap,
    y,
    color: first.color,
    icon: first.icon || 'circle',
    tags: ['chronologie', 'étape'],
    notes: '',
    resources: [],
    metadata: { pattern: 'timeline-step' },
    depth: 0,
    scale,
    scaleLocked: true,
    wFactor: first.wFactor ?? 1.25,
    hFactor: first.hFactor ?? 0.85,
  };
  const edge: KnowledgeEdge = {
    id: `e-${last.id}-${id}-seq`,
    source: last.id,
    target: id,
    type: 'related',
    style: 'solid',
    label: 'puis',
  };
  return { node, edge };
}
