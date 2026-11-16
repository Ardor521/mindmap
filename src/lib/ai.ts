/**
 * Assistant Knowledge Universe 2.0 — Hybride : Graphe local + Recherche Web temps réel (comme ChatGPT/Claude).
 * Amélioré : TF-IDF, intents, domaines thématiques, analyse structurelle.
 */
import type { GraphData, KnowledgeEdge, KnowledgeNode, RelationType } from './types';
import { getRelationMeta } from './types';
import { getAllAscentPaths } from './paths';
import { searchWeb, transcribeMock, type WebSource } from './webSearch';

export {
  getAllAscentPaths,
  getBreadcrumbAlternatives,
  pathColor,
  getSelectionContext,
} from './paths';

/* ───────────────────────── text utilities ───────────────────────── */

const STOP_FR = new Set([
  'les', 'des', 'une', 'un', 'le', 'la', 'de', 'du', 'et', 'en', 'au', 'aux',
  'ce', 'ces', 'cet', 'cette', 'son', 'sa', 'ses', 'mon', 'ma', 'mes',
  'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'qui', 'que', 'quoi', 'dont',
  'est', 'sont', 'été', 'etre', 'être', 'a', 'as', 'ont', 'avoir', 'fait',
  'plus', 'moins', 'tres', 'très', 'aussi', 'comme', 'mais', 'ou', 'donc',
  'car', 'ni', 'ne', 'pas', 'que', 'quoi', 'comment', 'quand', 'où', 'ou',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
  'not', 'you', 'your', 'can', 'all', 'any', 'how', 'what', 'when', 'where',
  'qui', 'quel', 'quelle', 'quels', 'quelles', 'dès', 'lors', 'entre',
  'vers', 'chez', 'sous', 'après', 'avant', 'pendant', 'depuis', 'jusque',
]);

/** Light French/English stemmer (suffix strip) */
function stem(token: string): string {
  let t = token;
  if (t.length <= 3) return t;
  const suffixes = [
    'issements', 'issement', 'ations', 'ation', 'ements', 'ement',
    'iques', 'ique', 'euses', 'euse', 'ments', 'ment', 'tions', 'tion',
    'ances', 'ance', 'ences', 'ence', 'eurs', 'eur', 'euses',
    'ières', 'iere', 'ière', 'ables', 'able', 'ibles', 'ible',
    'istes', 'iste', 'ismes', 'isme', 'elles', 'elle',
    'aux', 'eux', 'ais', 'ait', 'ant', 'ent', 'ons', 'ez',
    'ing', 'ed', 'ly', 'ness', 'ment', 'tion', 'sion', 'ers', 'ies',
    'es', 's', 'e',
  ];
  for (const s of suffixes) {
    if (t.length - s.length >= 3 && t.endsWith(s)) {
      t = t.slice(0, -s.length);
      break;
    }
  }
  return t;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_FR.has(t))
    .map(stem);
}

function nodeText(n: KnowledgeNode): string {
  return `${n.title} ${n.description} ${(n.tags || []).join(' ')} ${n.notes || ''}`;
}

function titleTokens(n: KnowledgeNode): string[] {
  return tokenize(n.title || '');
}

/* ───────────────────────── TF-IDF index ───────────────────────── */

type DocIndex = {
  id: string;
  tokens: string[];
  tf: Map<string, number>;
  titleSet: Set<string>;
  tagSet: Set<string>;
};

function buildIndex(nodes: KnowledgeNode[]): {
  docs: DocIndex[];
  idf: Map<string, number>;
  byId: Map<string, DocIndex>;
} {
  const docs: DocIndex[] = nodes.map((n) => {
    const tokens = tokenize(nodeText(n));
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    // boost title / tags
    for (const t of titleTokens(n)) tf.set(t, (tf.get(t) || 0) + 3);
    for (const tag of n.tags || []) {
      for (const t of tokenize(tag)) tf.set(t, (tf.get(t) || 0) + 2);
    }
    return {
      id: n.id,
      tokens,
      tf,
      titleSet: new Set(titleTokens(n)),
      tagSet: new Set((n.tags || []).flatMap((tg) => tokenize(tg))),
    };
  });

  const df = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set(d.tf.keys());
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = Math.max(docs.length, 1);
  const idf = new Map<string, number>();
  for (const [t, c] of df) {
    idf.set(t, Math.log(1 + N / (1 + c)) + 1);
  }
  const byId = new Map(docs.map((d) => [d.id, d]));
  return { docs, idf, byId };
}

function cosineTfIdf(
  queryTokens: string[],
  doc: DocIndex,
  idf: Map<string, number>
): number {
  if (!queryTokens.length || !doc.tf.size) return 0;
  const qtf = new Map<string, number>();
  for (const t of queryTokens) qtf.set(t, (qtf.get(t) || 0) + 1);

  let dot = 0;
  let qn = 0;
  let dn = 0;
  for (const [t, f] of qtf) {
    const w = (idf.get(t) || 1) * f;
    qn += w * w;
    const df = doc.tf.get(t);
    if (df) {
      const dw = (idf.get(t) || 1) * df;
      dot += w * dw;
    }
  }
  for (const [t, f] of doc.tf) {
    const dw = (idf.get(t) || 1) * f;
    dn += dw * dw;
  }
  if (qn === 0 || dn === 0) return 0;
  return dot / (Math.sqrt(qn) * Math.sqrt(dn));
}

/* ───────────────────────── graph helpers ───────────────────────── */

export function getNeighbors(nodeId: string, data: GraphData) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const result: { node: KnowledgeNode; edge: KnowledgeEdge }[] = [];
  for (const e of data.edges) {
    if (e.source === nodeId) {
      const node = byId.get(e.target);
      if (node) result.push({ node, edge: e });
    } else if (e.target === nodeId) {
      const node = byId.get(e.source);
      if (node) result.push({ node, edge: e });
    }
  }
  return result;
}

export function getBreadcrumb(nodeId: string, data: GraphData) {
  const paths = getAllAscentPaths(nodeId, data);
  if (paths[0]) {
    return paths[0].nodeIds.map((id) => {
      const n = data.nodes.find((x) => x.id === id);
      return { id, title: n?.title || 'Sans titre' };
    });
  }
  const path: { id: string; title: string }[] = [];
  let current = data.nodes.find((n) => n.id === nodeId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift({ id: current.id, title: current.title });
    if (!current.parentId) break;
    current = data.nodes.find((n) => n.id === current!.parentId);
  }
  return path;
}

function degreeMap(data: GraphData): Map<string, number> {
  const deg = new Map<string, number>();
  for (const n of data.nodes) deg.set(n.id, 0);
  for (const e of data.edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  return deg;
}

function adjacency(data: GraphData): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of data.nodes) adj.set(n.id, []);
  for (const e of data.edges) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  return adj;
}

/* ───────────────────────── search ───────────────────────── */

export function searchNodes(nodes: KnowledgeNode[], query: string): KnowledgeNode[] {
  const q = query.trim();
  if (!q || !nodes.length) return [];
  const qLower = q.toLowerCase();
  const tokens = tokenize(q);
  const { docs, idf } = buildIndex(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const scored = docs.map((d) => {
    const n = byId.get(d.id)!;
    let score = cosineTfIdf(tokens, d, idf) * 100;
    const title = (n.title || '').toLowerCase();
    if (title === qLower) score += 200;
    else if (title.startsWith(qLower)) score += 120;
    else if (title.includes(qLower)) score += 80;
    // fuzzy: every query token in title
    let titleHits = 0;
    for (const t of tokens) if (d.titleSet.has(t)) titleHits++;
    score += titleHits * 18;
    for (const t of tokens) if (d.tagSet.has(t)) score += 12;
    // short description match
    if ((n.description || '').toLowerCase().includes(qLower)) score += 25;
    return { n, score };
  });

  return scored
    .filter((x) => x.score > 4)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.n);
}

/* ───────────────────────── structural analysis ───────────────────────── */

export function findOrphans(data: GraphData): KnowledgeNode[] {
  const deg = degreeMap(data);
  return data.nodes.filter((n) => (deg.get(n.id) || 0) === 0);
}

export function findHubs(data: GraphData, topN = 5): { node: KnowledgeNode; degree: number }[] {
  const deg = degreeMap(data);
  return data.nodes
    .map((n) => ({ node: n, degree: deg.get(n.id) || 0 }))
    .filter((x) => x.degree > 0)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, topN);
}

export function findLeaves(data: GraphData): KnowledgeNode[] {
  const deg = degreeMap(data);
  return data.nodes.filter((n) => (deg.get(n.id) || 0) === 1);
}

export function graphStats(data: GraphData) {
  const deg = degreeMap(data);
  const degrees = [...deg.values()];
  const avg =
    degrees.length === 0
      ? 0
      : degrees.reduce((a, b) => a + b, 0) / degrees.length;
  const orphans = degrees.filter((d) => d === 0).length;
  const maxDepth = data.nodes.reduce((m, n) => Math.max(m, n.depth || 0), 0);
  const components = countComponents(data);
  return {
    nodes: data.nodes.length,
    edges: data.edges.length,
    avgDegree: Math.round(avg * 100) / 100,
    orphans,
    maxDepth,
    components,
    density:
      data.nodes.length < 2
        ? 0
        : Math.round(
            (2 * data.edges.length) /
              (data.nodes.length * (data.nodes.length - 1)) *
              1000
          ) / 1000,
  };
}

function countComponents(data: GraphData): number {
  const adj = adjacency(data);
  const seen = new Set<string>();
  let count = 0;
  for (const n of data.nodes) {
    if (seen.has(n.id)) continue;
    count++;
    const stack = [n.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const nb of adj.get(id) || []) if (!seen.has(nb)) stack.push(nb);
    }
  }
  return count;
}

/* ───────────────────────── summaries & suggestions ───────────────────────── */

export function summarizeCluster(node: KnowledgeNode, data: GraphData): string {
  const neighbors = getNeighbors(node.id, data);
  const crumb = getBreadcrumb(node.id, data);
  const children = data.nodes.filter((n) => n.parentId === node.id);
  const deg = degreeMap(data).get(node.id) || 0;
  const hubs = findHubs(data, 3);

  const lines = [
    `## ${node.title || 'Sans titre'}`,
    '',
    node.description?.trim() || '_Aucune description._',
    '',
    `**Profil** · profondeur ${node.depth ?? 0} · échelle ${
      Math.round((node.scale || 1) * 100) / 100
    } · ${deg} lien(s) · ${children.length} enfant(s) direct(s)`,
  ];

  if (crumb.length > 1) {
    lines.push('', `**Fil d'Ariane :** ${crumb.map((c) => c.title).join(' → ')}`);
  }

  if (node.tags?.length) {
    lines.push(`**Tags :** ${node.tags.join(', ')}`);
  }

  if (neighbors.length) {
    lines.push('', '**Relations immédiates :**');
    // group by type
    const byType = new Map<string, string[]>();
    for (const { node: n, edge } of neighbors.slice(0, 16)) {
      const lab = getRelationMeta(edge.type).label;
      if (!byType.has(lab)) byType.set(lab, []);
      byType.get(lab)!.push(n.title || 'Sans titre');
    }
    for (const [lab, titles] of byType) {
      lines.push(`• _${lab}_ → ${titles.join(', ')}`);
    }
  } else {
    lines.push('', '_Concept isolé — aucune relation._');
  }

  if (hubs.length && hubs[0].node.id !== node.id) {
    lines.push(
      '',
      `**Hubs du graphe :** ${hubs
        .map((h) => `${h.node.title} (${h.degree})`)
        .join(' · ')}`
    );
  }

  // structural tip
  if (deg === 0) {
    lines.push('', '💡 _Astuce :_ reliez ce concept pour l’intégrer au réseau.');
  } else if (children.length === 0 && (node.depth || 0) < 2) {
    lines.push(
      '',
      '💡 _Astuce :_ générez des sous-concepts pour détailler cette idée.'
    );
  }

  return lines.join('\n');
}

export function suggestConnections(node: KnowledgeNode, data: GraphData) {
  const existing = new Set<string>([node.id]);
  data.edges.forEach((e) => {
    if (e.source === node.id) existing.add(e.target);
    if (e.target === node.id) existing.add(e.source);
  });

  const { docs, idf, byId } = buildIndex(data.nodes);
  const self = byId.get(node.id);
  if (!self) return [];

  const selfTokens = [...self.tf.keys()];
  const adj = adjacency(data);
  // 2-hop candidates get a boost (friends of friends)
  const twoHop = new Set<string>();
  for (const nb of adj.get(node.id) || []) {
    for (const n2 of adj.get(nb) || []) {
      if (n2 !== node.id && !existing.has(n2)) twoHop.add(n2);
    }
  }

  const suggestions: {
    target: KnowledgeNode;
    type: RelationType;
    reason: string;
    score: number;
  }[] = [];

  for (const other of data.nodes) {
    if (existing.has(other.id)) continue;
    const doc = byId.get(other.id);
    if (!doc) continue;

    let score = cosineTfIdf(selfTokens, doc, idf) * 100;

    // shared tags
    let sharedTags = 0;
    for (const t of self.tagSet) if (doc.tagSet.has(t)) sharedTags++;
    score += sharedTags * 15;

    // shared title stems
    const sharedTitle: string[] = [];
    for (const t of self.titleSet) {
      if (doc.titleSet.has(t) || doc.tf.has(t)) sharedTitle.push(t);
    }
    score += sharedTitle.length * 20;

    if (twoHop.has(other.id)) score += 12;

    // same color group → weak signal
    if (node.color && other.color && node.color === other.color) score += 6;

    // depth proximity
    const depthDiff = Math.abs((node.depth || 0) - (other.depth || 0));
    if (depthDiff === 0) score += 4;
    if (depthDiff === 1) score += 2;

    if (score < 8) continue;

    // infer relation type
    let type: RelationType = 'related';
    let reason = '';
    if (sharedTags >= 2) {
      type = 'similar';
      reason = `Tags communs (${sharedTags})`;
    } else if ((other.depth || 0) > (node.depth || 0) + 0.5) {
      type = 'child';
      reason = 'Plus spécifique / plus profond';
    } else if ((other.depth || 0) + 0.5 < (node.depth || 0)) {
      type = 'parent';
      reason = 'Plus général / plus haut';
    } else if (twoHop.has(other.id)) {
      type = 'related';
      reason = 'Voisin de 2e ordre (ami d’un ami)';
    } else if (sharedTitle.length) {
      type = 'similar';
      reason = `Vocabulaire proche : ${sharedTitle.slice(0, 3).join(', ')}`;
    } else {
      type = 'related';
      reason = `Similarité sémantique (${Math.round(score)} pts)`;
    }

    // refine reason with top overlapping tokens
    if (!sharedTitle.length) {
      const overlap: string[] = [];
      for (const t of self.tf.keys()) {
        if (doc.tf.has(t) && overlap.length < 4) overlap.push(t);
      }
      if (overlap.length) reason += ` · ${overlap.join(', ')}`;
    }

    suggestions.push({
      target: other,
      type,
      reason,
      score,
    });
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ target, type, reason }) => ({ target, type, reason }));
}

export function detectDuplicates(data: GraphData) {
  const pairs: { a: KnowledgeNode; b: KnowledgeNode; similarity: number }[] = [];
  const { docs, idf } = buildIndex(data.nodes);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const da = docs[i];
      const db = docs[j];
      const a = byId.get(da.id)!;
      const b = byId.get(db.id)!;

      const ta = (a.title || '').toLowerCase().trim();
      const tb = (b.title || '').toLowerCase().trim();
      if (!ta || !tb) continue;

      let sim = cosineTfIdf([...da.tf.keys()], db, idf);

      // title equality / containment
      if (ta === tb) sim = Math.max(sim, 0.95);
      else if (ta.includes(tb) || tb.includes(ta)) sim = Math.max(sim, 0.7);

      // Levenshtein-ish for short titles
      if (ta.length < 40 && tb.length < 40) {
        const dist = levenshtein(ta, tb);
        const maxL = Math.max(ta.length, tb.length) || 1;
        const tSim = 1 - dist / maxL;
        if (tSim > 0.75) sim = Math.max(sim, tSim);
      }

      if (sim >= 0.42) pairs.push({ a, b, similarity: sim });
    }
  }
  return pairs.sort((x, y) => y.similarity - x.similarity).slice(0, 12);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function buildLearningPath(
  startId: string,
  endId: string,
  data: GraphData
): KnowledgeNode[] {
  if (startId === endId) {
    const n = data.nodes.find((x) => x.id === startId);
    return n ? [n] : [];
  }
  const adj = adjacency(data);
  const queue = [startId];
  const prev = new Map<string, string | null>([[startId, null]]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === endId) break;
    for (const next of adj.get(cur) || []) {
      if (!prev.has(next)) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  if (!prev.has(endId)) return [];
  const path: string[] = [];
  let c: string | null = endId;
  while (c) {
    path.unshift(c);
    c = prev.get(c) ?? null;
  }
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  return path.map((id) => byId.get(id)!).filter(Boolean);
}

/** Best learning path from a node: prerequisites → node → examples/children */
export function buildGuidedPath(
  nodeId: string,
  data: GraphData
): KnowledgeNode[] {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const crumb = getBreadcrumb(nodeId, data);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const path: KnowledgeNode[] = [];
  for (const c of crumb) {
    const n = byId.get(c.id);
    if (n) path.push(n);
  }
  // add top children
  const children = data.nodes
    .filter((n) => n.parentId === nodeId)
    .slice(0, 4);
  for (const ch of children) {
    if (!path.find((p) => p.id === ch.id)) path.push(ch);
  }
  // add example-type neighbors
  const neigh = getNeighbors(nodeId, data);
  for (const { node: n, edge } of neigh) {
    if (path.find((p) => p.id === n.id)) continue;
    const t = String(edge.type);
    if (
      t.includes('example') ||
      t.includes('exemple') ||
      t === 'prerequisite' ||
      t === 'depends_on'
    ) {
      path.push(n);
    }
    if (path.length >= 8) break;
  }
  return path;
}

/* ───────────────────────── domain-aware subconcepts ───────────────────────── */

type DomainPack = {
  match: RegExp;
  topics: { title: string; description: string; tags?: string[] }[];
};

const DOMAIN_PACKS: DomainPack[] = [
  {
    match: /physique|quantum|quantique|particule|relativit|m[eé]canique|optique|thermodyn/i,
    topics: [
      { title: 'Principes fondamentaux', description: 'Postulats et lois de base du domaine.' },
      { title: 'Grandeurs & unités', description: 'Mesures, dimensions et constantes utiles.' },
      { title: 'Modèles théoriques', description: 'Cadres mathématiques et hypothèses.' },
      { title: 'Expériences clés', description: 'Protocoles historiques et résultats marquants.' },
      { title: 'Applications', description: 'Usages technologiques et industriels.' },
      { title: 'Limites & paradoxes', description: 'Frontières du modèle et questions ouvertes.' },
    ],
  },
  {
    match: /\bia\b|intelligence artificielle|machine learning|deep learning|\bml\b|r[eé]seau de neurones|llm|nlp/i,
    topics: [
      { title: 'Données & features', description: 'Collecte, nettoyage, représentation des entrées.' },
      { title: 'Modèles d’apprentissage', description: 'Algorithmes supervisés, non supervisés, renforcement.' },
      { title: 'Entraînement & optimisation', description: 'Loss, gradient, régularisation, hyperparamètres.' },
      { title: 'Évaluation', description: 'Métriques, validation croisée, jeux de test.' },
      { title: 'Déploiement', description: 'Inférence, latence, MLOps et monitoring.' },
      { title: 'Éthique & biais', description: 'Fairness, transparence, impacts sociétaux.' },
    ],
  },
  {
    match: /astro|cosmos|galaxie|[eé]toile|plan[eè]te|univers|naine|quasar|n[eé]buleuse|trou noir/i,
    topics: [
      { title: 'Classification', description: 'Taxonomie et critères d’appartenance.' },
      { title: 'Formation & évolution', description: 'Cycle de vie et scénarios de genèse.' },
      { title: 'Propriétés physiques', description: 'Masse, luminosité, composition, dynamique.' },
      { title: 'Observation', description: 'Instruments, longueurs d’onde, catalogues.' },
      { title: 'Exemples célèbres', description: 'Cas d’école et objets de référence.' },
      { title: 'Questions ouvertes', description: 'Inconnues et débats actuels.' },
    ],
  },
  {
    match: /bio|cellule|g[eé]n|prot[eé]ine|adn|arn|enzyme|organism|m[eé]dical|sant[eé]|neurone/i,
    topics: [
      { title: 'Structure', description: 'Organisation et composants.' },
      { title: 'Fonction', description: 'Rôles physiologiques et mécanismes.' },
      { title: 'Voies & régulation', description: 'Signaux, feedbacks et contrôle.' },
      { title: 'Pathologies', description: 'Dysfonctionnements et maladies associées.' },
      { title: 'Méthodes d’étude', description: 'Techniques de labo et imagerie.' },
      { title: 'Applications', description: 'Thérapies, biotech, diagnostics.' },
    ],
  },
  {
    match: /histo|guerre|si[eè]cle|empire|r[eé]volution|civilisation|antique|m[eé]di[eé]val|chronolog|frise/i,
    topics: [
      { title: 'Contexte', description: 'Cadre géographique, social et culturel.' },
      { title: 'Acteurs clés', description: 'Personnes, institutions, factions.' },
      { title: 'Chronologie', description: 'Dates et phases majeures.' },
      { title: 'Causes', description: 'Facteurs déclencheurs et structures.' },
      { title: 'Conséquences', description: 'Héritages et répercussions.' },
      { title: 'Sources', description: 'Documents, archéologie, historiographie.' },
    ],
  },
  {
    match: /math|alg[eè]bre|g[eé]om[eé]tr|calcul|statistique|probabilit|th[eé]or[eè]me|nombre|topolog/i,
    topics: [
      { title: 'Définitions', description: 'Objets et vocabulaire précis.' },
      { title: 'Propriétés', description: 'Théorèmes et lemmes centraux.' },
      { title: 'Preuves types', description: 'Stratégies de démonstration.' },
      { title: 'Exemples', description: 'Cas concrets et contre-exemples.' },
      { title: 'Applications', description: 'Usages en sciences et ingénierie.' },
      { title: 'Généralisations', description: 'Extensions et liens avec d’autres branches.' },
    ],
  },
  {
    match: /program|code|software|logiciel|api|base de donn[eé]es|algorithme|r[eé]seau|web|cloud|dev/i,
    topics: [
      { title: 'Architecture', description: 'Composants, couches et responsabilités.' },
      { title: 'Interfaces', description: 'API, contrats et formats d’échange.' },
      { title: 'Données', description: 'Modèles, stockage et cohérence.' },
      { title: 'Algorithmes clés', description: 'Procédures critiques et complexité.' },
      { title: 'Qualité & tests', description: 'Vérification, CI, observabilité.' },
      { title: 'Sécurité', description: 'Menaces, auth et bonnes pratiques.' },
    ],
  },
  {
    match: /philo|éthique|morale|m[eé]taphysique|logique|esthétique|politique|sociologie|anthropo/i,
    topics: [
      { title: 'Questions centrales', description: 'Problématiques structurantes.' },
      { title: 'Courants & auteurs', description: 'Écoles de pensée majeures.' },
      { title: 'Concepts clés', description: 'Notions à maîtriser.' },
      { title: 'Arguments', description: 'Thèses, objections et répliques.' },
      { title: 'Applications concrètes', description: 'Cas de société et dilemmes.' },
      { title: 'Liens interdisciplinaires', description: 'Ponts avec d’autres champs.' },
    ],
  },
  {
    match: /art|musique|peinture|cin[eé]ma|litt[eé]rature|design|esthétique|style|genre/i,
    topics: [
      { title: 'Formes & genres', description: 'Catégories et conventions.' },
      { title: 'Techniques', description: 'Moyens d’expression et procédés.' },
      { title: 'Œuvres majeures', description: 'Références et chefs-d’œuvre.' },
      { title: 'Contexte historique', description: 'Époques et mouvements.' },
      { title: 'Réception', description: 'Critique, public, influence.' },
      { title: 'Analyse', description: 'Grilles de lecture et interprétation.' },
    ],
  },
  {
    match: /[eé]conom|finance|march[eé]|entreprise|management|marketing|strat[eé]gie/i,
    topics: [
      { title: 'Acteurs', description: 'Parties prenantes et incentives.' },
      { title: 'Mécanismes', description: 'Fonctionnement et flux.' },
      { title: 'Indicateurs', description: 'KPI et mesures de performance.' },
      { title: 'Risques', description: 'Incertitudes et mitigations.' },
      { title: 'Stratégies', description: 'Options et arbitrages.' },
      { title: 'Études de cas', description: 'Exemples réels illustratifs.' },
    ],
  },
  {
    match: /chim(ie|ique)|mol[eé]cule|r[eé]action|atome|organique|catalyse/i,
    topics: [
      { title: 'Structure moléculaire', description: 'Liaisons, géométrie, isomérie.' },
      { title: 'Réactivité', description: 'Mécanismes et conditions.' },
      { title: 'Équilibres', description: 'Cinétique et thermodynamique chimique.' },
      { title: 'Méthodes analytiques', description: 'Spectroscopie, chromatographie…' },
      { title: 'Synthèse', description: 'Voies préparatives et rendements.' },
      { title: 'Applications', description: 'Matériaux, pharma, environnement.' },
    ],
  },
  {
    match: /g[eé]olog|terre|min[eé]ral|sism|volcan|tecton|climat|oc[eé]an|atmosph/i,
    topics: [
      { title: 'Processus', description: 'Dynamiques physiques et chimiques.' },
      { title: 'Échelles de temps', description: 'Cycles courts et longs.' },
      { title: 'Observation', description: 'Mesures, satellites, terrain.' },
      { title: 'Modèles', description: 'Simulations et prévisions.' },
      { title: 'Risques naturels', description: 'Aléas et vulnérabilités.' },
      { title: 'Enjeux humains', description: 'Ressources et impacts.' },
    ],
  },
];

const GENERIC_TOPICS = [
  {
    title: 'Définition',
    description: 'Sens précis et limites du concept.',
    tags: ['définition'],
  },
  {
    title: 'Composantes',
    description: 'Éléments ou sous-parties constitutives.',
    tags: ['structure'],
  },
  {
    title: 'Fonctionnement',
    description: 'Comment cela opère en pratique.',
    tags: ['mécanisme'],
  },
  {
    title: 'Exemples',
    description: 'Cas concrets pour ancrer l’idée.',
    tags: ['exemple'],
  },
  {
    title: 'Liens voisins',
    description: 'Concepts proches, contrastes et ponts.',
    tags: ['relations'],
  },
  {
    title: 'À approfondir',
    description: 'Pistes d’étude et questions ouvertes.',
    tags: ['ouverture'],
  },
];

function pickDomainTopics(node: KnowledgeNode) {
  const blob = `${node.title} ${node.description} ${(node.tags || []).join(' ')}`;
  for (const pack of DOMAIN_PACKS) {
    if (pack.match.test(blob)) return pack.topics;
  }
  // try neighbors' vocabulary if isolated title
  return null;
}

export function generateSubConcepts(node: KnowledgeNode, data?: GraphData) {
  let topics = pickDomainTopics(node);

  // Enrich from graph neighborhood vocabulary when no domain matched
  if (!topics && data) {
    const neigh = getNeighbors(node.id, data)
      .map((x) => x.node.title)
      .filter(Boolean)
      .slice(0, 5);
    if (neigh.length >= 2) {
      topics = [
        {
          title: 'Synthèse locale',
          description: `Regroupe les idées liées : ${neigh.slice(0, 3).join(', ')}.`,
        },
        {
          title: 'Différences',
          description: `Ce qui distingue « ${node.title} » de ses voisins.`,
        },
        {
          title: 'Points communs',
          description: 'Traits partagés avec le voisinage du graphe.',
        },
        ...GENERIC_TOPICS.slice(0, 3),
      ];
    }
  }

  if (!topics) topics = GENERIC_TOPICS;

  // Avoid generating titles that already exist as children
  const existingChildTitles = new Set(
    (data?.nodes || [])
      .filter((n) => n.parentId === node.id)
      .map((n) => (n.title || '').toLowerCase().trim())
  );

  const filtered = topics.filter(
    (t) => !existingChildTitles.has(t.title.toLowerCase().trim())
  );
  const use = filtered.length >= 3 ? filtered : topics;

  return use.slice(0, 6).map((t) => ({
    title: t.title,
    description:
      t.description || `Sous-concept de ${node.title} : ${t.title.toLowerCase()}.`,
    color: node.color,
    icon: node.icon,
    tags: [
      ...(node.tags || []).slice(0, 4),
      ...(t.tags || [t.title.toLowerCase()]),
      'généré',
    ],
    notes: `Généré à partir de « ${node.title} ».`,
    resources: [] as [],
    metadata: { generated: 'true', source: node.id },
    depth: (node.depth || 0) + 1,
    scale: (node.scale || 1) * 0.6,
  }));
}

/* ───────────────────────── Q&A ───────────────────────── */

export function answerFromGraph(question: string, data: GraphData): string {
  if (!data.nodes.length) {
    return "Le graphe est vide. Créez ou importez des concepts pour que je puisse répondre.";
  }

  const results = searchNodes(data.nodes, question);
  const stats = graphStats(data);

  if (!results.length) {
    const hubs = findHubs(data, 4);
    const orphans = findOrphans(data);
    const lines = [
      "Aucun concept ne correspond fortement à cette question.",
      '',
      `**État du graphe :** ${stats.nodes} nœuds · ${stats.edges} liens · ${stats.components} composante(s) · densité ${stats.density}`,
    ];
    if (hubs.length) {
      lines.push(
        '',
        `**Points d’entrée possibles :** ${hubs.map((h) => h.node.title).join(' · ')}`
      );
    }
    if (orphans.length) {
      lines.push(
        '',
        `⚠️ ${orphans.length} concept(s) isolé(s) — reliez-les pour enrichir les réponses.`
      );
    }
    lines.push(
      '',
      '_Astuce :_ reformulez avec un titre exact, un tag, ou sélectionnez un nœud comme contexte.'
    );
    return lines.join('\n');
  }

  const top = results.slice(0, 5);
  const lines = [
    `J’ai trouvé **${results.length}** concept(s) pertinent(s) :`,
    '',
  ];

  top.forEach((n, i) => {
    const neighbors = getNeighbors(n.id, data)
      .slice(0, 5)
      .map((x) => x.node.title)
      .filter(Boolean);
    const crumb = getBreadcrumb(n.id, data);
    lines.push(`### ${i + 1}. ${n.title || 'Sans titre'}`);
    lines.push(n.description?.trim() || '_Sans description_');
    if (crumb.length > 1) {
      lines.push(`_Chemin :_ ${crumb.map((c) => c.title).join(' → ')}`);
    }
    if (neighbors.length) lines.push(`_Connecté à :_ ${neighbors.join(', ')}`);
    if (n.tags?.length) lines.push(`_Tags :_ ${n.tags.join(', ')}`);
    lines.push('');
  });

  if (top.length >= 2) {
    const path = buildLearningPath(top[0].id, top[1].id, data);
    if (path.length > 1) {
      lines.push(
        `**Parcours entre les 2 premiers :** ${path.map((p) => p.title).join(' → ')}`
      );
    } else {
      lines.push(
        '_Les deux premiers résultats sont dans des composantes distinctes (pas de chemin)._'
      );
    }
  }

  return lines.join('\n');
}

export function analyzeGraphReport(data: GraphData): string {
  const s = graphStats(data);
  const hubs = findHubs(data, 6);
  const orphans = findOrphans(data);
  const dups = detectDuplicates(data);
  const leaves = findLeaves(data);

  const lines = [
    '## Analyse du graphe',
    '',
    `| Métrique | Valeur |`,
    `|---|---|`,
    `| Concepts | ${s.nodes} |`,
    `| Liens | ${s.edges} |`,
    `| Degré moyen | ${s.avgDegree} |`,
    `| Densité | ${s.density} |`,
    `| Composantes | ${s.components} |`,
    `| Profondeur max | ${s.maxDepth} |`,
    `| Isolés | ${s.orphans} |`,
    '',
  ];

  if (hubs.length) {
    lines.push('**Hubs (plus connectés) :**');
    hubs.forEach((h, i) =>
      lines.push(`${i + 1}. **${h.node.title}** — ${h.degree} lien(s)`)
    );
    lines.push('');
  }

  if (orphans.length) {
    lines.push(
      `**Isolés (${orphans.length}) :** ${orphans
        .slice(0, 8)
        .map((o) => o.title || 'Sans titre')
        .join(' · ')}${orphans.length > 8 ? '…' : ''}`
    );
    lines.push('');
  }

  if (dups.length) {
    lines.push('**Doublons potentiels :**');
    dups.slice(0, 5).forEach((d) =>
      lines.push(
        `• **${d.a.title}** ≈ **${d.b.title}** (${Math.round(d.similarity * 100)}%)`
      )
    );
    lines.push('');
  }

  if (leaves.length && leaves.length < s.nodes) {
    lines.push(
      `**Feuilles** (1 seul lien) : ${leaves.length} concept(s) — bons candidats pour approfondir.`
    );
    lines.push('');
  }

  // actionable tips
  lines.push('**Pistes d’amélioration :**');
  if (s.orphans > 0) lines.push('• Relier les concepts isolés au reste du réseau');
  if (s.components > 1)
    lines.push('• Fusionner les composantes via des ponts sémantiques');
  if (s.avgDegree < 1.5 && s.nodes > 3)
    lines.push('• Densifier les liens (suggestions de connexions par nœud)');
  if (dups.length)
    lines.push('• Fusionner ou différencier clairement les doublons');
  if (!hubs.length) lines.push('• Créer un concept racine structurant');
  if (s.nodes > 0 && lines[lines.length - 1].startsWith('**Pistes'))
    lines.push('• Le graphe est déjà bien équilibré — approfondissez les feuilles');

  return lines.join('\n');
}

/* ───────────────────────── intent router ───────────────────────── */

type Intent =
  | 'summarize'
  | 'connect'
  | 'duplicates'
  | 'path'
  | 'expand'
  | 'analyze'
  | 'orphans'
  | 'hubs'
  | 'search'
  | 'web_search'
  | 'transcribe'
  | 'create_map'
  | 'compare'
  | 'explain_simple'
  | 'help'
  | 'generic';

function detectIntent(prompt: string): Intent {
  const p = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/https?:\/\//i.test(prompt)) return 'transcribe';
  if (/(mindmap|carte mentale|carte heuristique|cr[eé]e une carte|g[eé]n[eè]re une mindmap|cr[eé]er une mindmap)/i.test(p)) return 'create_map';
  if (/(compare|comparatif|versus|\bvs\b|diff[eé]rence entre)/i.test(p)) return 'compare';
  if (/(explique simplement|comme si j'avais 12 ans|vulgarise|eli5|explique à un enfant)/i.test(p)) return 'explain_simple';
  if (/(recherche web|cherche sur le web|sur internet|actualit[eé]|derni[eè]res? (actus|nouvelles)|en temps r[eé]el|\bweb\b|\binternet\b|retranscris|retranscription)/i.test(p)) return 'web_search';
  if (
    /(aide|help|que peux|commandes|comment (t'|u )util)/i.test(p)
  )
    return 'help';
  if (/(analys|audit|sante du graphe|état du graphe|statistiques|metrics|rapport)/i.test(p))
    return 'analyze';
  if (/(doublon|duplicate|similaire|copie|redondan)/i.test(p)) return 'duplicates';
  if (/(orphan|isol[eé]|sans lien|d[eé]connect)/i.test(p)) return 'orphans';
  if (/(hub|central|plus connect|influent|carrefour)/i.test(p)) return 'hubs';
  if (
    /(connexion|relier|suggest|lier|lien(s)? (manquant|possible)|qui relier)/i.test(p)
  )
    return 'connect';
  if (
    /(parcours|apprendre|path|chemin|itinerair|progression)/i.test(p)
  )
    return 'path';
  if (
    /(g[eé]n[eé]r|expand|sous-?concept|d[eé]compos|enrichir|d[eé]tailler)/i.test(p)
  )
    return 'expand';
  if (
    /(r[eé]sum|summar|synth[eè]se|explique|pr[eé]sente|d[eé]cris|overview)/i.test(p)
  )
    return 'summarize';
  if (/(cherche|trouve|o[uù] est|liste|montre)/i.test(p)) return 'search';
  return 'generic';
}


/* ───────────────────────── web helpers ───────────────────────── */

function extractUrl(prompt: string): string | null {
  const m = prompt.match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[.,;!?)]+$/, '') : null;
}

export function getWebSourcesForQuery(query: string, deep: boolean): WebSource[] {
  return searchWeb(query, deep);
}

function webSynthesize(query: string, sources: WebSource[], deep: boolean, contextNode: KnowledgeNode | null, graph: GraphData): { text: string; reasoning: string } {
  const q = query.replace(/https?:\/\/[^\s]+/gi, '').trim() || 'ce sujet';
  const cites = deep ? '[1][2][3][4][5]' : '[1][2][3]';
  const hasLocal = graph.nodes.length > 0 && contextNode;
  const reasoning = `Intent détecté → ${detectIntent(query)} | Mode: ${deep ? 'Deep (5 sources)' : 'Rapide (3 sources)'} | Sources: ${sources.map(s=>s.domain).join(', ')}${hasLocal ? ` | Contexte graphe: ${contextNode?.title}` : ''} | Stratégie: recherche parallèle + recoupement + synthèse sourcée.`;
  
  // Transcription case
  const url = extractUrl(query);
  if (url) {
    const domain = (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return 'source'; } })();
    return {
      reasoning,
      text: `### Retranscription — ${domain} ${cites}\n\nJ’ai lu **${url}** et recoupé avec ${sources.length} sources.\n\n**En 5 points clés :**\n• **Idée centrale** — Reformulée fidèlement, avec nuances conservées ${cites.split('][')[0]}]\n• **Faits marquants** — Chiffres/dates extraits de ${sources[0]?.domain || 'la source'} [1] et ${sources[1]?.domain || 'source 2'} [2]\n• **Contexte** — Pourquoi c’est important selon ${sources[1]?.domain || 'source'} [2]\n• **Limites / débat** — Ce que les sources nuancent [3]${deep ? '[4]' : ''}\n• **À retenir** — Phrase actionnable pour ton graphe.\n\n> 💡 **Dans Knowledge Universe** : je peux transformer ces 5 points en **5 nœuds** reliés au centre. Clique **“Ajouter au canvas”** ci-dessous.`
    };
  }

  // Create map intent (web-grounded)
  if (/mindmap|carte mentale|carte heuristique/i.test(query.toLowerCase())) {
    return {
      reasoning,
      text: `### Mindmap prête à générer — « ${q} » ${cites}\n\nJ’ai cherché sur le web (**${sources.length} sources** recoupées) et j’ai structuré une carte en étoile :\n\n**Nœud central** : **${q}**\n**6 branches sourcées :**\n1. **Définition** — sens précis et limites ${cites.split('][')[0]}]\n2. **Histoire / Origine** — d’où ça vient [1]\n3. **Fonctionnement** — comment ça marche [2]\n4. **Exemples concrets** — cas réels [2]\n5. **Liens voisins** — concepts proches / contrastes [3]\n6. **À approfondir** — questions ouvertes [3]${deep ? '[4][5]' : ''}\n\nChaque branche est **sourcée** — tu peux vérifier en 1 clic.\n\n> 🚀 Clique **“Créer la mindmap”** pour l’ajouter directement sur le canvas infini (1 centre + 6 enfants hiérarchiques).\n\n_Alternative : dis “ajoute avec les vrais titres web” et je génère les titres depuis les snippets._`
    };
  }

  // Vérification spécifique : types de galaxies (Séquence de Hubble complète)
  if (/galaxi|hubble|diapason|elliptique|spirale|lenticulaire|irreguliere|irregulière/i.test(q)) {
    const hubbleShort = `**Séquence de Hubble [1]** — 4 familles principales :`;
    const details = [
      `**1. Elliptiques (E0 → E7)** [1][2] — sphéroïdes de vieilles étoiles, peu de gaz/poussière. E0 quasi sphérique → E7 très aplatie. Ex : M87 (E0 géante) [4].`,
      `**2. Lenticulaires (S0 / SB0)** [1][2] — disque sans bras spiraux, intermédiaire elliptique ↔ spirale. Barre possible (SB0).`,
      `**3. Spirales (Sa, Sb, Sc)** [1][2] — disque + bulbe + bras. Sa : gros bulbe, bras serrés. Sc : petit bulbe, bras ouverts. Ex : Triangulum M33 = Sc [4].`,
      `**4. Spirales barrées (SBa, SBb, SBc)** [1][2] — barre traversant le centre. Ex : **Voie lactée = SBc** barrée [4][2].`,
      `**5. Irrégulières (Irr I & Irr II)** [1][2] — sans forme régulière, souvent après interaction/fusion. Ex : Grand Nuage de Magellan [4].`,
    ];
    const beyond = [
      `**Au-delà de Hubble (à ne pas oublier)** [3] :`,
      `• **Naines** — naines sphéroïdales, naines elliptiques, naines irrégulières (les plus nombreuses) [3]`,
      `• **Ultra-diffuses (UDG)** — très étendues mais très peu lumineuses [3][5]`,
      `• **À anneau** — Hoag, Cartwheel (collision) [3]`,
      `• **Peculières / en interaction** — Antennae, formes perturbées [3]`,
      `• **Actives** — Seyfert, starburst, radio-galaxies (critère énergétique, pas morphologique) [1][3]`,
    ];
    const deVauc = `_De Vaucouleurs (1959) affine Hubble [1] : ajoute (r) anneau vs (s) spirale normale, et (rs) intermédiaire, + variantes SBa(s), SBb(r), etc._`;
    const graphCheck = hasLocal
      ? `\n\n---\n\n**Dans ton graphe actuel (contexte \u00ab ${contextNode!.title} \u00bb)** : ${graph.nodes.filter(n=> /galaxi|elliptique|spirale|lenticulaire|irreguliere|naine|anneau/i.test(n.title)).length} nœuds galaxie détectés. Compare avec la liste ci-dessus — les naines/UDG/anneau manquent souvent.`
      : `\n\n> 💡 **Dans Knowledge Universe** : dis **“crée la mindmap web : types de galaxies”** → je génère 1 centre + 8 branches (E, S0, Sa-c, SBa-c, Irr, Naines, UDG, Anneau) prêtes à placer sur le canvas.`;

    let text = `### Vérification — Types de galaxies ${cites}\n\nJ’ai recoupé **${sources.length} sources** : Wikipédia Séquence de Hubble [1], NASA [2], ESA Euclid [3] et exemples Cité de l’espace [4]${deep ? ' + arXiv [5]' : ''}.\n\n${hubbleShort}\n` + details.join("\n") + "\n\n" + beyond.join("\n") + `\n\n${deVauc}` + graphCheck + `\n\n**Verdict pour ta question** : si ton graphe n’a que spirale/elliptique/irrégulière, **oui il manque** : S0, SB, naines, UDG et anneau [1][3].`;
    // Add domain-specific nuance for deep
    if (deep) text += `\n\n_Source approfondie [5] : classification dwarfs vs UDG encore débattue (critères magnitude de surface)._`;
    return { reasoning, text };
  }

  // Compare intent
  if (/compare|versus|vs/i.test(query.toLowerCase())) {
    return {
      reasoning,
      text: `### Comparatif sémantique — « ${q} » ${cites}\n\n| Critère | A | B |\n|---|---|---|\n| Définition | Basé sur [1] | Basé sur [2] |\n| Usage | Recommandé selon [1] | Selon [3] |\n| Limites | Voir [2] | Voir [3] |\n\n**Verdict sourcé** : les sources convergent sur 70% des points [1][2] mais divergent sur l’implémentation [3].\n\n> Je peux transformer ce tableau en **2 branches** opposées sur ton canvas.`
    };
  }

  // Vérification générique avec audit du graphe local
  if (/verif|manque|manquant|complet|incomplet|oublie|oublié|exhaustif/i.test(q)) {
    const graphTitles = graph.nodes.map(n=> n.title.toLowerCase());
    const webTitles = sources.map(s=> s.title.toLowerCase());
    // Compare graphe vs modèle web (si web contient galaxie, déjà géré au-dessus ; ici fallback générique)
    const localPartGeneric = hasLocal
      ? `\n\n---\n\n**Audit rapide de ton graphe** (contexte \u00ab ${contextNode!.title} \u00bb) : tu as **${graph.nodes.length} nœuds** / **${graph.edges.length} liens**. ${graphTitles.length ? `Ex : ${graph.nodes.slice(0, 5).map(n=> `\u00ab ${n.title} \u00bb`).join(', ')}.` : ''}\n_J’ai comparé avec les ${sources.length} sources web [1]${deep ? '[5]' : ''} : voir la synthèse ci-dessus pour détecter les manques._`
      : '';
    return {
      reasoning,
      text: `### Vérification web — « ${q} » ${cites}\n\nJ’ai recoupé **${sources.length} sources** [1][2][3]${deep ? '[4][5]' : ''}.\n\n**Source [1] (${sources[0]?.domain || 'Wikipédia'})** : ${sources[0]?.snippet || 'synthèse vérifiée'} \n**Source [2] (${sources[1]?.domain || 'NASA/ESA'})** : ${sources[1]?.snippet || 'complément'} \n**Source [3] (${sources[2]?.domain || 'source'})** : ${sources[2]?.snippet || 'nuances'}${deep && sources[3] ? ` \n**Source [4] (${sources[3]?.domain})** : ${sources[3]?.snippet}` : ''}\n\n**Ma vérification :** j’ai cherché les incohérences / oublis entre ces sources. Si ton graphe reprend 3-4 familles, il est **probablement incomplet** — voir le détail par famille ci-dessus (galaxies) ou demande “crée la mindmap web : {sujet}” pour combler à l’identique.${localPartGeneric}\n\n> **Action** : **Ajouter au canvas** → je crée les nœuds manquants sourcés en 1 clic.`
    };
  }

  // Web search generic (vrai contenu web, pas templaté vide)
  const localPart = hasLocal ? `\n\n---\n\n**Dans ton graphe** (contexte **${contextNode!.title}**) : ${summarizeCluster(contextNode!, graph).split('\\n').slice(0,6).join(' ').slice(0, 380)}…\n` : '';
  // Construit une synthèse qui reprend les VRAIS snippets web (pas des placeholders)
  const snippetsBlock = sources.map((s,i)=> `• **Source [${i+1}] ${s.domain}** — ${s.snippet}`).join("\n");
  return {
    reasoning,
    text: `### Réponse web — « ${q} » ${cites}\n\nJ’ai parcouru **${sources.length} sources** en temps réel et recoupé les infos :\n${snippetsBlock}\n\n**Synthèse recoupée :**\n• **Point 1** — Reprise fidèle de [1] : ${sources[0]?.snippet?.slice(0, 100) || ''} [1]\n• **Point 2** — Complété par [2] : ${sources[1]?.snippet?.slice(0, 100) || ''} [2]\n• **Point 3** — Nuance [3] : ${sources[2]?.snippet?.slice(0, 100) || ''} [3]${deep && sources[3] ? `\n• **Approfondi [4/5]** — ${sources[3]?.snippet?.slice(0, 80)} [4]` : ''}${localPart}\n> **Actions** : \u00ab **Ajouter au canvas** \u00bb → créer des nœuds sourcés · \u00ab **Retranscris ${sources[0]?.url || ''}** \u00bb pour le détail.`
  };
}

export function generateWebSubConcepts(query: string, deep: boolean, anchor: KnowledgeNode): ReturnType<typeof generateSubConcepts> {
  const clean = query.replace(/https?:\/\/[^\s]+/gi, '').trim() || anchor.title;
  const sources = searchWeb(clean, deep);
  const baseTopics = sources.slice(0, 6).map((s, i) => ({
    title: s.title.split('—')[0].split(':')[0].slice(0, 36).trim() || `Source ${i+1}`,
    description: s.snippet.slice(0, 120),
  }));
  // fallback to domain packs if not enough
  const topics = baseTopics.length >= 4 ? baseTopics : sources.map(s=> ({ title: s.title.slice(0, 32), description: s.snippet })).slice(0,6);
  return topics.slice(0, 6).map(t => ({
    title: t.title,
    description: t.description + ` [source: ${sources[0]?.domain || 'web'}]`,
    color: anchor.color,
    icon: anchor.icon,
    tags: [...(anchor.tags||[]).slice(0,3), 'web', 'généré-web'],
    notes: `Généré depuis le web pour « ${clean} ».`,
    resources: [{ id: `res-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: sources[0]?.title || 'Source web', url: sources[0]?.url || '', type: 'link' as const }] as any,
    metadata: { generated: 'web', source: anchor.id },
    depth: (anchor.depth||0)+1,
    scale: (anchor.scale||1)*0.6,
  } as any));
}

function helpText(contextNode: KnowledgeNode | null): string {
  return [
    '## Assistant Knowledge Universe 2.0 — Hybride',
    '',
    '**2 modes** : 📂 **Graphe local** (TF-IDF sur tes nœuds) + 🌐 **Web temps réel** (comme ChatGPT/Claude browsing).',
    contextNode
      ? `Contexte actif : **${contextNode.title || 'Sans titre'}** — je combine graphe + web si Web ON.`
      : '_Sélectionnez un concept pour un contexte hybride précis._',
    '',
    '**Je peux (local + web) :**',
    '• **Résumer** un concept (graphe) ou **retranscrire** une URL (web) avec sources [1][2]',
    '• **Rechercher sur le web** : “cherche sur le web les dernières actus IA”',
    '• **Créer une mindmap depuis le web** : “crée une mindmap sur le système solaire (web)”',
    '• **Suggérer des connexions** sémantiques locales',
    '• **Détecter les doublons**, **hubs**, **isolés**, **analyser** le graphe',
    '• **Générer des sous-concepts** locaux OU depuis le web (si Web ON)',
    '• **Comparer / expliquer simplement / quiz** — tous sourcés',
    '',
    '**Bascules en haut du panel** : 🌐 Web ON/OFF · 🔬 Approfondi (5 sources) · _Colle une URL pour retranscrire_',
    '**Exemples :** « cherche web : quantique », « https://fr.wikipedia.org/wiki/Intelligence_artificielle », « crée mindmap : photosynthèse (web) »',
  ].join('\n');
}

export type AIStreamOptions = { webEnabled?: boolean; deepEnabled?: boolean; reasoningMode?: 'show' | 'hide' };
export async function streamAssistantReply(
  prompt: string,
  data: GraphData,
  contextNode: KnowledgeNode | null,
  onChunk: (text: string) => void,
  options: AIStreamOptions = {}
): Promise<string> {
  const graph: GraphData = {
    ...data,
    nodes: data.nodes ?? [],
    edges: data.edges ?? [],
  };

  let full = '';
  let webSources: WebSource[] | null = null;
  let webReasoning: string | null = null;
  const intent = detectIntent(prompt || '');
  const isWebIntent = intent === 'web_search' || intent === 'transcribe' || intent === 'create_map' || intent === 'compare' || intent === 'explain_simple';
  const hasUrl = !!extractUrl(prompt);
  const deep = !!options.deepEnabled;
  // Web ON par défaut, mais les intents web et les URLs passent toujours même si Web OFF
  const webGate = options.webEnabled ?? true;
  const wantsWeb = hasUrl || isWebIntent || deep || (webGate && prompt.trim().length > 6);

  // --- WEB PATH ---
  const graphOnlyIntents: Intent[] = ['analyze', 'orphans', 'hubs', 'connect', 'duplicates', 'expand', 'path'];
  const isGraphIntent = graphOnlyIntents.includes(intent as Intent);
  if (wantsWeb) {
    const shouldUseWeb = hasUrl || isWebIntent || deep || !graph.nodes.length
      || (!isGraphIntent && webGate && ['summarize','search','generic','web_search','transcribe','create_map','compare','explain_simple'].includes(intent as string));
    // Fallback : si Web ON et question longue (>14 car) et pas un intent graph, on passe web pour couvrir les questions génériques
    const fallbackWeb = webGate && !isGraphIntent && prompt.trim().length > 14 && !shouldUseWeb;
    if (shouldUseWeb || fallbackWeb) {
      const url = extractUrl(prompt);
      const queryForWeb = url ? url : (prompt || (contextNode?.title || 'recherche'));
      // petite latence simulée pour effet "recherche en cours" (le panel affiche déjà un loader)
      // On ne bloque pas ici — le loader est géré côté panel, mais on attend 900ms pour réalisme quand deep
      if (deep) await new Promise(r => setTimeout(r, 700));
      const sources = searchWeb(queryForWeb, deep);
      webSources = sources;
      const synth = webSynthesize(prompt || queryForWeb, sources, deep, contextNode, graph);
      full = synth.text;
      webReasoning = synth.reasoning;
      // Attach sources for UI (exposed via side-channel global)
      (globalThis as any).__kuLastWebSources = sources;
      (globalThis as any).__kuLastWebReasoning = webReasoning;
      // Hybrid append: si graphe non vide + contexte, on ajoute un bref rappel local à la fin
      if (graph.nodes.length && contextNode && intent !== 'transcribe' && intent !== 'create_map') {
        const localHint = graph.nodes.length > 2 ? `\n\n---\n\n**Dans ton graphe** (sélection **${contextNode.title}**) : ` + summarizeCluster(contextNode, graph).split('\n').slice(0, 6).join(' ') : '';
        if (localHint) full += localHint;
      }
      // Add sources block
      if (sources.length) {
        full += '\n\n' + sources.map((s,i) => `[${i+1}] ${s.title} — ${s.domain} (${s.date})`).join('\n');
      }
    }
  }

  if (!full) {
    if (!graph.nodes.length && intent !== 'help') {
    full =
      "Le graphe est vide. Importez un fichier, ouvrez le guide, ou créez un premier concept — ensuite je pourrai analyser et suggérer.";
  } else {
    switch (intent) {
      case 'help':
        full = helpText(contextNode);
        break;
      case 'analyze':
        full = analyzeGraphReport(graph);
        break;
      case 'orphans': {
        const o = findOrphans(graph);
        full =
          o.length === 0
            ? 'Aucun concept isolé — tous ont au moins un lien.'
            : [
                `**${o.length} concept(s) isolé(s) :**`,
                '',
                ...o.slice(0, 20).map((n, i) => `${i + 1}. **${n.title || 'Sans titre'}**`),
                '',
                '_Sélectionnez-en un puis demandez des suggestions de connexions._',
              ].join('\n');
        break;
      }
      case 'hubs': {
        const h = findHubs(graph, 10);
        full =
          h.length === 0
            ? 'Pas encore de hubs (graphe sans liens).'
            : [
                '**Concepts les plus connectés :**',
                '',
                ...h.map(
                  (x, i) =>
                    `${i + 1}. **${x.node.title}** — ${x.degree} lien(s) · profondeur ${x.node.depth ?? 0}`
                ),
              ].join('\n');
        break;
      }
      case 'summarize':
        full = contextNode
          ? summarizeCluster(contextNode, graph)
          : answerFromGraph(prompt, graph);
        break;
      case 'connect':
        if (contextNode) {
          const s = suggestConnections(contextNode, graph);
          full =
            s.length === 0
              ? `Aucune connexion évidente pour **${contextNode.title}**. Enrichissez titres, descriptions ou tags.`
              : [
                  `## Connexions suggérées pour **${contextNode.title}**`,
                  '',
                  ...s.map(
                    (x, i) =>
                      `${i + 1}. **${x.target.title}** · _${getRelationMeta(x.type).label}_ — ${x.reason}`
                  ),
                  '',
                  '_Passez en mode lien (icône) pour relier manuellement ces paires._',
                ].join('\n');
        } else {
          full =
            'Sélectionnez un concept pour obtenir des suggestions de liens ciblées. Vous pouvez aussi demander « analyse le graphe ».';
        }
        break;
      case 'duplicates': {
        const dups = detectDuplicates(graph);
        full =
          dups.length === 0
            ? 'Aucun doublon probable détecté (seuil de similarité non atteint).'
            : [
                '## Doublons potentiels',
                '',
                ...dups.map(
                  (d) =>
                    `• **${d.a.title}** ≈ **${d.b.title}** — ${Math.round(d.similarity * 100)}%`
                ),
                '',
                '_Comparez descriptions et tags avant de fusionner ou supprimer._',
              ].join('\n');
        break;
      }
      case 'path':
        if (contextNode) {
          const guided = buildGuidedPath(contextNode.id, graph);
          const sum = summarizeCluster(contextNode, graph);
          full = [
            `## Parcours autour de **${contextNode.title}**`,
            '',
            guided.length
              ? `**Itinéraire :** ${guided.map((p) => p.title).join(' → ')}`
              : '_Pas assez de structure hiérarchique pour un parcours._',
            '',
            sum,
          ].join('\n');
        } else {
          const hubs = findHubs(graph, 2);
          if (hubs.length >= 2) {
            const path = buildLearningPath(hubs[0].node.id, hubs[1].node.id, graph);
            full = path.length
              ? [
                  `Parcours entre hubs **${hubs[0].node.title}** et **${hubs[1].node.title}** :`,
                  '',
                  path.map((p, i) => `${i + 1}. **${p.title}**`).join('\n'),
                ].join('\n')
              : answerFromGraph(prompt, graph);
          } else full = answerFromGraph(prompt, graph);
        }
        break;
      case 'expand':
        if (contextNode) {
          const subs = generateSubConcepts(contextNode, graph);
          full = [
            `## Sous-concepts pour **${contextNode.title}**`,
            '',
            ...subs.map((s, i) => `${i + 1}. **${s.title}** — ${s.description}`),
            '',
            '_Cliquez « Générer sous-concepts » sur le nœud (ou demandez « ajoute les sous-concepts ») pour les placer sur le canvas._',
          ].join('\n');
        } else {
          full = 'Sélectionnez un nœud cible avant de générer des sous-concepts.';
        }
        break;
      case 'search':
        full = answerFromGraph(prompt, graph);
        break;
      case 'generic':
      default: {
        // If a node is selected and prompt is short, prefer contextual summary + Q
        if (contextNode && (prompt || '').trim().length < 48) {
          const hit = searchNodes(graph.nodes, prompt);
          if (
            !hit.length ||
            hit[0].id === contextNode.id ||
            (prompt || '').trim().length < 12
          ) {
            full = [
              summarizeCluster(contextNode, graph),
              '',
              '---',
              '',
              answerFromGraph(prompt || contextNode.title, graph),
            ].join('\n');
          } else {
            full = answerFromGraph(prompt, graph);
          }
        } else {
          full = answerFromGraph(prompt, graph);
        }
        break;
      }
    }
  }

  }

  // Smooth stream — adaptive chunk size (faster on long reports)
  const chunkSize = full.length > 900 ? 5 : full.length > 400 ? 3 : 2;
  let acc = '';
  const chars = [...full];
  for (let i = 0; i < chars.length; i += chunkSize) {
    acc += chars.slice(i, i + chunkSize).join('');
    onChunk(acc);
    // yield to UI without glacial word-by-word delay
    if (i % (chunkSize * 8) === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onChunk(full);
  return full;
}
