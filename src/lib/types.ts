export type BuiltinRelationType =
  | 'parent' | 'child' | 'depends_on' | 'uses' | 'similar' | 'opposite'
  | 'complementary' | 'prerequisite' | 'example' | 'cause' | 'consequence' | 'related';

export type RelationType = BuiltinRelationType | (string & {});
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';

export interface RelationTypeDef {
  id: string;
  label: string;
  color: string;
  style?: EdgeStyle;
  dashed?: boolean;
  hierarchical?: boolean;
  fontSize?: number;
  custom?: boolean;
}

export type RelationTypeOverride = {
  label?: string;
  color?: string;
  style?: EdgeStyle;
  dashed?: boolean;
  fontSize?: number;
};

export interface KnowledgeNode {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  tags: string[];
  notes: string;
  resources: Resource[];
  imageUrl?: string;
  metadata: Record<string, string>;
  depth: number;
  scale: number;
  parentId?: string;
  isPrimary?: boolean;
  scaleLocked?: boolean;
  /** Forme du bloc (1 = carré). Largeur = base × wFactor */
  wFactor?: number;
  /** Hauteur = base × hFactor */
  hFactor?: number;
  /** Division multicolore : le même concept est découpé en N couleurs (infini) */
  colorSegments?: string[];
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'file' | 'note' | 'video' | 'image';
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  label?: string;
  color?: string;
  style?: EdgeStyle;
  fontSize?: number;
}

export interface Camera { x: number; y: number; zoom: number; }
export interface ViewportSize { width: number; height: number; }

/** Chosen at workspace creation — not a live toggle. */
export type MapKind = 'universe' | 'mindmap';

export interface GraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  projectName?: string;
  /** universe = échelles / zoom infini · mindmap = plan 2D classique */
  mapKind?: MapKind;
  customColors?: string[];
  relationColors?: Partial<Record<string, string>>;
  relationOverrides?: Partial<Record<string, RelationTypeOverride>>;
  customRelationTypes?: RelationTypeDef[];
  favoriteIcons?: string[];
  legendSize?: { width: number; height: number };
  conceptLegendSize?: { width: number; height: number };
  defaultLinkFontSize?: number;
  /** Couleur par défaut des nouveaux concepts (null = hérite du parent) */
  defaultNodeColor?: string | null;
  /** Noms des groupes de concepts par couleur (clé = couleur hex normalisée) */
  colorGroupLabels?: Record<string, string>;
}

export interface BreadcrumbItem { id: string; title: string; }
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export const BUILTIN_RELATION_META: Record<
  BuiltinRelationType,
  { label: string; color: string; dashed?: boolean; hierarchical?: boolean }
> = {
  parent: { label: 'Parent', color: '#6366f1', hierarchical: true },
  child: { label: 'Enfant', color: '#8b5cf6', hierarchical: true },
  depends_on: { label: 'Dépend de', color: '#f59e0b', dashed: true },
  uses: { label: 'Utilise', color: '#06b6d4' },
  similar: { label: 'Similaire', color: '#10b981', dashed: true },
  opposite: { label: 'Opposé', color: '#ef4444', dashed: true },
  complementary: { label: 'Complémentaire', color: '#ec4899' },
  prerequisite: { label: 'Prérequis', color: '#f97316' },
  example: { label: 'Exemple', color: '#84cc16', dashed: true },
  cause: { label: 'Cause', color: '#eab308' },
  consequence: { label: 'Conséquence', color: '#a855f7' },
  related: { label: 'Relié', color: '#64748b', dashed: true },
};

export const RELATION_META = BUILTIN_RELATION_META;
export const BUILTIN_RELATION_IDS = Object.keys(BUILTIN_RELATION_META) as BuiltinRelationType[];

export function isBuiltinRelation(type: string): type is BuiltinRelationType {
  return type in BUILTIN_RELATION_META;
}

export function isHierarchicalRelation(type: RelationType): boolean {
  return type === 'parent' || type === 'child';
}

/** Default stroke for a relation type. Hierarchical types are always solid. */
export function defaultStyleForRelation(
  type: RelationType,
  customTypes?: RelationTypeDef[] | null,
  overrides?: Partial<Record<string, RelationTypeOverride>> | null
): EdgeStyle {
  if (isHierarchicalRelation(type)) return 'solid';
  const o = overrides?.[type];
  if (o?.style === 'solid' || o?.style === 'dashed' || o?.style === 'dotted') {
    // Never allow dotted on hierarchical customs either
    const custom = customTypes?.find((c) => c.id === type);
    if (custom?.hierarchical && o.style === 'dotted') return 'solid';
    return o.style;
  }
  if (isBuiltinRelation(type)) {
    return BUILTIN_RELATION_META[type].dashed ? 'dashed' : 'solid';
  }
  const custom = customTypes?.find((c) => c.id === type);
  if (custom?.hierarchical) return custom.style === 'dashed' ? 'dashed' : 'solid';
  if (custom?.style === 'dotted' || custom?.style === 'dashed' || custom?.style === 'solid') {
    return custom.style;
  }
  if (custom?.dashed) return 'dashed';
  return 'solid';
}

/** True if this type participates in parent/child hierarchy by semantics. */
export function isHierarchyType(
  type: RelationType,
  customTypes?: RelationTypeDef[] | null
): boolean {
  if (isHierarchicalRelation(type)) return true;
  const custom = customTypes?.find((c) => c.id === type);
  if (custom?.hierarchical) return true;
  const id = String(type).toLowerCase();
  return (
    id.includes('enfant') ||
    id.includes('child') ||
    id.includes('parent') ||
    id.includes('conten') ||
    id.includes('example') ||
    id.includes('exemple')
  );
}

export function slugifyRelationId(label: string): string {
  const base = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  return base || `custom_${Date.now().toString(36)}`;
}

export function getAllRelationTypes(
  custom?: RelationTypeDef[] | null,
  overrides?: Partial<Record<string, RelationTypeOverride>> | null,
  relationColors?: Partial<Record<string, string>> | null
): RelationTypeDef[] {
  const builtins: RelationTypeDef[] = BUILTIN_RELATION_IDS.map((id) => {
    const b = BUILTIN_RELATION_META[id];
    const o = overrides?.[id];
    const style: EdgeStyle = o?.style || (o?.dashed || b.dashed ? 'dashed' : 'solid');
    return {
      id, label: o?.label || b.label,
      color: o?.color || relationColors?.[id] || b.color,
      style, dashed: style !== 'solid', hierarchical: b.hierarchical,
      fontSize: o?.fontSize, custom: false,
    };
  });
  const builtinSet = new Set(BUILTIN_RELATION_IDS as string[]);
  const customs = (custom ?? []).filter((c) => !builtinSet.has(c.id)).map((c) => {
    const o = overrides?.[c.id];
    const style: EdgeStyle = o?.style || c.style || (c.dashed || o?.dashed ? 'dashed' : 'solid');
    return {
      ...c, label: o?.label || c.label,
      color: o?.color || relationColors?.[c.id] || c.color,
      style, dashed: style !== 'solid',
      fontSize: o?.fontSize ?? c.fontSize, custom: true as const,
    };
  });
  return [...builtins, ...customs];
}

export function getRelationColor(
  type: RelationType,
  relationColors?: Partial<Record<string, string>> | null,
  customTypes?: RelationTypeDef[] | null,
  overrides?: Partial<Record<string, RelationTypeOverride>> | null
): string {
  if (overrides?.[type]?.color) return overrides[type]!.color!;
  if (relationColors?.[type]) return relationColors[type]!;
  if (isBuiltinRelation(type)) return BUILTIN_RELATION_META[type].color;
  return customTypes?.find((c) => c.id === type)?.color || '#64748b';
}

export function getRelationMeta(
  type: RelationType,
  relationColors?: Partial<Record<string, string>> | null,
  customTypes?: RelationTypeDef[] | null,
  overrides?: Partial<Record<string, RelationTypeOverride>> | null
) {
  let base: { label: string; color: string; dashed?: boolean; hierarchical?: boolean; style?: EdgeStyle; fontSize?: number };
  if (isBuiltinRelation(type)) {
    const b = BUILTIN_RELATION_META[type];
    base = { label: b.label, color: b.color, dashed: b.dashed, hierarchical: b.hierarchical, style: b.dashed ? 'dashed' : 'solid' };
  } else {
    const custom = customTypes?.find((c) => c.id === type);
    base = custom
      ? { label: custom.label, color: custom.color, dashed: custom.dashed || custom.style === 'dashed' || custom.style === 'dotted', hierarchical: custom.hierarchical, style: custom.style || (custom.dashed ? 'dashed' : 'solid'), fontSize: custom.fontSize }
      : { ...BUILTIN_RELATION_META.related, label: String(type), style: 'dashed' as EdgeStyle };
  }
  const o = overrides?.[type];
  if (o?.label) base.label = o.label;
  if (o?.fontSize != null) base.fontSize = o.fontSize;
  if (o?.style) { base.style = o.style; base.dashed = o.style !== 'solid'; }
  else if (o?.dashed != null) { base.dashed = o.dashed; base.style = o.dashed ? 'dashed' : 'solid'; }
  return { ...base, color: getRelationColor(type, relationColors, customTypes, overrides) };
}

export const NODE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
export const PLACEHOLDER_TITLE = 'Nouveau concept';
export const PLACEHOLDER_DESC = 'Décrivez cette idée…';
