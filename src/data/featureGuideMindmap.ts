import type { GraphData, KnowledgeEdge, KnowledgeNode } from '../lib/types';

const C = {
  root: '#a78bfa',
  d2: '#22d3ee',
  d3: '#c084fc',
  concepts: '#f472b6',
  links: '#fbbf24',
  leaf: '#cbd5e1',
  diff: '#94a3b8',
};

function n(
  id: string,
  title: string,
  description: string,
  x: number,
  y: number,
  opts: Partial<KnowledgeNode> & { color: string; depth: number; scale: number }
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
    metadata: { guide: 'true', ...(opts.metadata ?? {}) },
    depth: opts.depth,
    scale: opts.scale,
    parentId: opts.parentId,
    isPrimary: opts.isPrimary,
    scaleLocked: true,
    wFactor: opts.wFactor ?? 1,
    hFactor: opts.hFactor ?? 1,
  };
}

function e(
  id: string,
  source: string,
  target: string,
  type: KnowledgeEdge['type'] = 'child',
  style: KnowledgeEdge['style'] = 'solid',
  label?: string
): KnowledgeEdge {
  return { id, source, target, type, style, label };
}

/** Horizontal fan with optional vertical bias */
function fan(
  cx: number,
  cy: number,
  count: number,
  i: number,
  spread: number,
  dy: number
) {
  const mid = (count - 1) / 2;
  const t = count <= 1 ? 0 : (i - mid) / Math.max(mid, 1);
  return {
    x: cx + (i - mid) * spread,
    y: cy + dy + t * t * 30,
  };
}

/**
 * Layout aéré (rien tout en bas d’un seul père) :
 *
 *              [ LIENS — commun 2D+3D ]
 *                       |
 *          [2D] ---- [ ROOT ] ---- [3D]
 *                       |
 *              [ CONCEPTS — commun 2D+3D ]
 *
 * Les deux premiers liens depuis la racine restent 2D puis 3D.
 * Liens au-dessus, Concepts en dessous.
 */
export function createFeatureGuideMindmap(): GraphData {
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];

  const add = (node: KnowledgeNode) => nodes.push(node);
  const child = (a: string, b: string) =>
    edges.push(e(`e-${a}-${b}`, a, b, 'child', 'solid'));

  // ── ROOT ──────────────────────────────────────────
  add(
    n(
      'g-root',
      'Knowledge Universe',
      'Guide. Les 2 premiers liens = 2D et 3D (spécificités). En haut = tout sur les Liens (commun). En bas = tout sur les Concepts (commun). Flèches + Entrée pour explorer.',
      0,
      0,
      {
        color: C.root,
        depth: 0,
        scale: 1,
        isPrimary: true,
        icon: 'sparkles',
        tags: ['guide'],
        wFactor: 1.5,
        hFactor: 1,
      }
    )
  );

  // ── 1er et 2e lien : 2D / 3D (gauche / droite) ────
  add(
    n(
      'g-2d',
      '2D',
      'Mindmap plane. Mêmes outils que le 3D. Chaîne illimitée ; après 3 niveaux la taille ne diminue plus automatiquement (±10 % manuel toujours possible). Titre dans le bloc (sauf image).',
      -720,
      0,
      {
        color: C.d2,
        depth: 1,
        scale: 0.6,
        parentId: 'g-root',
        icon: 'network',
        tags: ['2d'],
        wFactor: 1.3,
      }
    )
  );
  add(
    n(
      'g-3d',
      '3D',
      'Univers zoomable à l’infini. Mêmes concepts/liens que la 2D, sans limite de profondeur. Double-clic pour plonger.',
      720,
      0,
      {
        color: C.d3,
        depth: 1,
        scale: 0.6,
        parentId: 'g-root',
        icon: 'orbit',
        tags: ['3d'],
        wFactor: 1.3,
      }
    )
  );
  child('g-root', 'g-2d');
  child('g-root', 'g-3d');

  // Différences 2D (autour de 2D, surtout en haut-gauche)
  const diff2d = [
    {
      id: 'd2-depth',
      title: 'Taille après 3 niveaux',
      desc: 'Enchaînement illimité. Après 3 père→fils, plus de réduction auto de taille. ±10 % reste possible.',
      icon: 'layers',
    },
    {
      id: 'd2-title',
      title: 'Titre dans le bloc',
      desc: 'Titre à l’intérieur du concept ; en dessous seulement s’il y a une image.',
      icon: 'type',
    },
    {
      id: 'd2-create',
      title: 'Création d’espace',
      desc: '+ → Mindmap 2D. Type fixé à la création.',
      icon: 'plus',
    },
  ];
  diff2d.forEach((d, i) => {
    const pos = fan(-720, 0, diff2d.length, i, 200, -280);
    add(
      n(d.id, d.title, d.desc, pos.x, pos.y, {
        color: C.diff,
        depth: 2,
        scale: 0.36,
        parentId: 'g-2d',
        icon: d.icon,
        tags: ['2d-only'],
        wFactor: 1.15,
      })
    );
    child('g-2d', d.id);
  });

  // Différences 3D (autour de 3D, surtout en haut-droite)
  const diff3d = [
    {
      id: 'd3-zoom',
      title: 'Zoom infini',
      desc: 'Molette sans limite. Double-clic nœud = plonger dans l’échelle.',
      icon: 'zoom-in',
    },
    {
      id: 'd3-scale',
      title: 'Échelles extrêmes',
      desc: 'Ordres de grandeur (atome → galaxie). Frères = même taille si normalisés.',
      icon: 'trending-up',
    },
    {
      id: 'd3-create',
      title: 'Création d’espace',
      desc: '+ → Univers 3D. Profondeur hiérarchique illimitée.',
      icon: 'plus',
    },
  ];
  diff3d.forEach((d, i) => {
    const pos = fan(720, 0, diff3d.length, i, 200, -280);
    add(
      n(d.id, d.title, d.desc, pos.x, pos.y, {
        color: C.diff,
        depth: 2,
        scale: 0.36,
        parentId: 'g-3d',
        icon: d.icon,
        tags: ['3d-only'],
        wFactor: 1.15,
      })
    );
    child('g-3d', d.id);
  });

  // ── LIENS (commun) — AU-DESSUS de la racine ───────
  add(
    n(
      'g-links',
      'Liens',
      'Tout ce qui concerne les relations — disponible en 2D et en 3D. (Zone du haut)',
      0,
      -420,
      {
        color: C.links,
        depth: 1,
        scale: 0.6,
        parentId: 'g-root',
        icon: 'link-2',
        tags: ['liens', 'commun'],
        wFactor: 1.25,
      }
    )
  );
  child('g-root', 'g-links');

  const linkLeaves = [
    {
      id: 'l-connect',
      title: 'Connexion (C)',
      desc: 'C → choisir le type → source → une ou plusieurs cibles → Entrée.',
      icon: 'link',
    },
    {
      id: 'l-types',
      title: 'Types',
      desc: 'Parent, Enfant, Dépend de, Utilise, Similaire, Opposé, Prérequis, Exemple, Cause, Conséquence, Relié + custom.',
      icon: 'tags',
      w: 1.3,
    },
    {
      id: 'l-styles',
      title: 'Styles de trait',
      desc: 'Plein · Pointillé · Tirets fins. Les tirets fins sont IGNORÉS pour la hiérarchie et la taille (jamais père/fils).',
      icon: 'pen-tool',
      w: 1.35,
    },
    {
      id: 'l-panel',
      title: 'Panneau Lien',
      desc: 'Clic sur un lien : type, libellé, couleur, style, police, suppression. Multi : Shift/Ctrl+L.',
      icon: 'settings',
    },
    {
      id: 'l-arrows',
      title: 'Flèches clavier',
      desc: 'Parcourir tous les voisins (tous types). Badge Père / Fils / Pair. Entrée = y aller. Échap = annuler.',
      icon: 'git-branch',
      w: 1.25,
    },
    {
      id: 'l-paths',
      title: 'Multi-chemins',
      desc: 'Clic concept : tous les chemins vers les racines s’illuminent. Fil d’Ariane multi-lignes.',
      icon: 'share-2',
    },
    {
      id: 'l-legend',
      title: 'Légende',
      desc: 'Bas-droite : types utilisés et couleurs. Redimensionnable.',
      icon: 'palette',
    },
    {
      id: 'l-insert',
      title: 'Insérer sur un lien',
      desc: 'Double-clic lien ou + au milieu : concept entre les deux extrémités.',
      icon: 'git-merge',
    },
    {
      id: 'l-related',
      title: 'Règle « Relié »',
      desc: 'Le type Relié ne compte en hiérarchie que si le concept n’a aucun autre type de lien.',
      icon: 'link-2',
    },
    {
      id: 'l-dotted',
      title: 'Tirets fins = hors arbre',
      desc: 'Un fils relié seulement en tirets fins à un gros nœud lointain NE prend PAS sa taille. Seuls plein/pointillé hiérarchiques comptent.',
      icon: 'pen-tool',
      w: 1.4,
    },
    {
      id: 'l-label',
      title: 'Libellé & police',
      desc: 'Texte sur le trait, taille par lien ou défaut projet.',
      icon: 'type',
    },
    {
      id: 'l-multi',
      title: 'Multi-liens',
      desc: 'Shift/Ctrl+L + rectangle : éditer plusieurs liens d’un coup.',
      icon: 'waypoints',
    },
  ];

  linkLeaves.forEach((leaf, i) => {
    // Two rows above for air
    const col = i % 6;
    const row = Math.floor(i / 6);
    const pos = fan(0, -420, 6, col, 210, -260 - row * 200);
    add(
      n(leaf.id, leaf.title, leaf.desc, pos.x, pos.y, {
        color: C.leaf,
        depth: 2,
        scale: 0.36,
        parentId: 'g-links',
        icon: leaf.icon,
        tags: ['liens'],
        wFactor: leaf.w ?? 1.1,
      })
    );
    child('g-links', leaf.id);
  });

  // Demo dotted (non-hierarchy) between two link leaves
  edges.push(
    e('e-demo-dot', 'l-styles', 'l-dotted', 'related', 'dotted', 'hors hiérarchie')
  );
  edges.push(
    e('e-demo-dash', 'l-types', 'l-styles', 'similar', 'dashed', 'pointillé')
  );

  // ── CONCEPTS (commun) — EN DESSOUS de la racine ───
  add(
    n(
      'g-concepts',
      'Concepts',
      'Tout ce qui concerne les blocs — disponible en 2D et en 3D. (Zone du bas)',
      0,
      420,
      {
        color: C.concepts,
        depth: 1,
        scale: 0.6,
        parentId: 'g-root',
        icon: 'box',
        tags: ['concepts', 'commun'],
        wFactor: 1.25,
      }
    )
  );
  child('g-root', 'g-concepts');

  const conceptLeaves = [
    {
      id: 'c-create',
      title: 'Créer',
      desc: 'N ou + · double-clic vide · + sur nœud (enfant) · insert sur lien.',
      icon: 'plus',
    },
    {
      id: 'c-info',
      title: 'Panneau Info',
      desc: 'Clic → droite : description, image, tags, couleur, icône, ★, échelle, forme, notes, ressources.',
      icon: 'file-text',
    },
    {
      id: 'c-scale',
      title: 'Échelle ±10%',
      desc: 'Change UNIQUEMENT la taille du bloc. Pas la longueur des liens, pas les positions.',
      icon: 'trending-up',
    },
    {
      id: 'c-shape',
      title: 'Forme L×H',
      desc: 'Largeur et hauteur indépendantes. Presets Carré / Large / Haut.',
      icon: 'square',
      w: 1.45,
      h: 0.8,
    },
    {
      id: 'c-image',
      title: 'Image',
      desc: 'URL ou fichier. Lightbox. En 2D : titre sous le bloc s’il y a une image.',
      icon: 'image',
    },
    {
      id: 'c-drag',
      title: 'Déplacement',
      desc: 'Glisser un concept ou toute la sélection. 2D et 3D.',
      icon: 'move',
    },
    {
      id: 'c-primary',
      title: 'Principal ★',
      desc: 'Marqueur or pour un concept clé.',
      icon: 'sparkles',
    },
    {
      id: 'c-notes',
      title: 'Notes & ressources',
      desc: 'Notes libres + liens externes attachés.',
      icon: 'book-open',
    },
    {
      id: 'c-bulk',
      title: 'Édition groupée',
      desc: 'Shift/Ctrl+C + sélection multiple : couleur, icône, échelle, suppression.',
      icon: 'layout-grid',
    },
    {
      id: 'c-delete',
      title: 'Supprimer',
      desc: 'Delete → reconnecter enfants, ponts pairs, ou rien.',
      icon: 'trash',
    },
    {
      id: 'c-search',
      title: 'Recherche',
      desc: 'Barre du haut : titres, tags, descriptions → vol vers le concept.',
      icon: 'search',
    },
    {
      id: 'c-nav',
      title: 'Vue & minimap',
      desc: 'Pan, zoom ±, vue d’ensemble, minimap bas-droite.',
      icon: 'map',
    },
  ];

  conceptLeaves.forEach((leaf, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const pos = fan(0, 420, 6, col, 210, 260 + row * 200);
    add(
      n(leaf.id, leaf.title, leaf.desc, pos.x, pos.y, {
        color: C.leaf,
        depth: 2,
        scale: 0.36,
        parentId: 'g-concepts',
        icon: leaf.icon,
        tags: ['concepts'],
        wFactor: leaf.w ?? 1.1,
        hFactor: leaf.h ?? 1,
      })
    );
    child('g-concepts', leaf.id);
  });

  // Soft related from 2D/3D to shared hubs (dashed, non-hierarchy if other types exist)
  edges.push(e('e-2d-links', 'g-2d', 'g-links', 'related', 'dashed', 'partage'));
  edges.push(e('e-3d-links', 'g-3d', 'g-links', 'related', 'dashed', 'partage'));
  edges.push(e('e-2d-c', 'g-2d', 'g-concepts', 'related', 'dashed', 'partage'));
  edges.push(e('e-3d-c', 'g-3d', 'g-concepts', 'related', 'dashed', 'partage'));

  return {
    projectName: 'Guide des fonctionnalités',
    mapKind: 'mindmap',
    nodes,
    edges,
    customColors: [C.root, C.d2, C.d3, C.concepts, C.links],
    relationColors: {},
    relationOverrides: {},
    customRelationTypes: [],
    favoriteIcons: ['sparkles', 'network', 'orbit', 'link-2', 'box', 'git-branch'],
    legendSize: { width: 200, height: 220 },
    defaultLinkFontSize: 11,
  };
}
