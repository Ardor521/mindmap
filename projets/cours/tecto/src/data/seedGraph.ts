import type { GraphData } from '../lib/types';

export function createEmptyGraph(mapKind: GraphData['mapKind'] = 'universe'): GraphData {
  return {
    nodes: [],
    edges: [],
    projectName: mapKind === 'mindmap' ? 'Ma mindmap' : 'Mon univers',
    mapKind: mapKind ?? 'universe',
    customColors: [],
    relationColors: {},
    relationOverrides: {},
    customRelationTypes: [],
    favoriteIcons: ['circle', 'sparkles', 'brain', 'atom', 'share-2'],
    legendSize: { width: 200, height: 200 },
    conceptLegendSize: { width: 200, height: 200 },
    defaultLinkFontSize: 12,
    defaultNodeColor: null,
    colorGroupLabels: {},
  };
}

export function createSeedGraph(): GraphData {
  return createEmptyGraph();
}
