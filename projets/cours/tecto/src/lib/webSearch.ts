/**
 * Knowledge Universe — Web Search hybrid (mock → vraie API)
 * Branchable sur Tavily / SerpAPI / Brave en remplaçant searchWeb().
 */
export type WebSource = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
  fav: string;
};

export const MOCK_DB: Record<string, WebSource[]> = {
  ia: [
    { id: '1', title: 'Stanford HAI 2026 — IA dépasse l’humain sur 8 benchmarks', url: 'https://hai.stanford.edu/ai-index-2026', snippet: 'Coût d’entraînement -70%, agents autonomes longue durée, modèles européens type Mistral Large 3 (256k).', domain: 'stanford.edu', date: 'Il y a 2 jours', fav: '🎓' },
    { id: '2', title: 'Mistral Large 3 vs GPT-5 — LMSYS leaderboard', url: 'https://lmsys.org/leaderboard', snippet: 'Mistral à 1.2T paramètres rivalise sur code & raisonnement, fenêtre 256k.', domain: 'lmsys.org', date: 'Hier', fav: '🇪🇺' },
    { id: '3', title: 'Le Monde — Agents IA : après les chatbots', url: 'https://www.lemonde.fr/technologies/ia-agents', snippet: 'OpenAI, Anthropic, Mistral déploient des agents qui naviguent le web.', domain: 'lemonde.fr', date: 'Il y a 3 jours', fav: '📰' },
  ],
  science: [
    { id: '1', title: 'CNRS — Intrication quantique expliquée', url: 'https://www.cnrs.fr/quantique-intrication', snippet: 'Deux particules intriquées restent liées instantanément, fondement du qubit.', domain: 'cnrs.fr', date: 'Mis à jour hier', fav: '⚛️' },
    { id: '2', title: 'Nature — IBM Condor 2 : 2000 qubits <0.1% erreur', url: 'https://www.nature.com/articles/ibm-condor2', snippet: 'Correction d’erreur sous 0.1% : premiers avantages quantiques utiles.', domain: 'nature.com', date: 'Il y a 4 jours', fav: '🔬' },
    { id: '3', title: 'CEA — Cas d’usage quantique', url: 'https://www.cea.fr/quantique-applications', snippet: 'Simulation moléculaire et optimisation logistique.', domain: 'cea.fr', date: 'Il y a 1 semaine', fav: '🧪' },
  ],
  histoire: [
    { id: '1', title: 'Wikipédia — Révolution française', url: 'https://fr.wikipedia.org/wiki/Révolution_française', snippet: 'Crise 1788, États Généraux, Bastille, Droits de l’Homme.', domain: 'wikipedia.org', date: 'Aujourd’hui', fav: '📜' },
    { id: '2', title: 'Gallica BnF — Cahiers de doléances 1789', url: 'https://gallica.bnf.fr/revolution-1789', snippet: 'Sources primaires numérisées.', domain: 'bnf.fr', date: 'Il y a 5 jours', fav: '🏛️' },
  ],
  espace: [
    { id: '1', title: 'Wikipédia — Séquence de Hubble : classification des galaxies', url: 'https://fr.wikipedia.org/wiki/Séquence_de_Hubble', snippet: '4 familles Hubble : elliptiques (E0-E7), lenticulaires (S0), spirales (Sa, Sb, Sc) et spirales barrées (SBa, SBb, SBc), plus irrégulières (Irr I/II). De Vaucouleurs affinera avec anneaux (r) et variantes.', domain: 'wikipedia.org', date: 'Mis à jour hier', fav: '📚' },
    { id: '2', title: 'NASA — Les types de galaxies : le diapason de Hubble', url: 'https://science.nasa.gov/universe/galaxies/types', snippet: 'Elliptiques: sphéroïdes de vieilles étoiles, peu de gaz. Lenticulaires S0: disque sans bras. Spirales: disque + bulbe + bras. Barrées SB: barre traversant le centre. Irrégulières: sans forme, souvent après interaction.', domain: 'nasa.gov', date: 'Mis à jour hier', fav: '🔭' },
    { id: '3', title: 'CNRS / ESA Euclid — Naines, ultra-diffuses et peculières', url: 'https://www.esa.int/Science_Exploration/Space_Science/Euclid/Types_galaxies', snippet: 'Au-delà de Hubble : naines sphéroïdales/dwarf ellipticals, naines irrégulières, ultra-diffuses (UDG), à anneau (Hoag, Cartwheel), peculières/en interaction, starburst et Seyfert/actives.', domain: 'esa.int', date: 'Hier', fav: '🌌' },
    { id: '4', title: 'Cité de l’espace — Exemples : Voie lactée, Andromède, Triangulum', url: 'https://www.cite-espace.com/galaxies-exemples', snippet: 'Voie lactée: spirale barrée SBc. Andromède M31: spirale Sb. Triangulum M33: Sc. M87: elliptique géante E0. Grand Nuage de Magellan: irrégulière naine.', domain: 'cite-espace.com', date: 'Il y a 4 jours', fav: '🌠' },
  ],
  japonais: [
    { id: '1', title: 'Japon — JLPT & grammaire', url: 'https://www.jlpt.jp/e/', snippet: 'N5-N1, particules は/が/を, ichidan/godan.', domain: 'jlpt.jp', date: 'Mis à jour hier', fav: '🇯🇵' },
    { id: '2', title: 'Tofugu — Kanji par radicaux', url: 'https://www.tofugu.com/kanji', snippet: '2000 kanji, mnémotechniques, ordre traits.', domain: 'tofugu.com', date: 'Il y a 3 jours', fav: '⛩️' },
  ],
  default: [
    { id: '1', title: 'Wikipédia — Synthèse vérifiée', url: 'https://fr.wikipedia.org/wiki/Recherche', snippet: 'Article de référence, bibliographie et historique.', domain: 'wikipedia.org', date: 'Aujourd’hui', fav: '📚' },
    { id: '2', title: 'Le Monde — Décryptage', url: 'https://www.lemonde.fr/decryptage', snippet: 'Analyse recoupée, sources officielles.', domain: 'lemonde.fr', date: 'Il y a 3 jours', fav: '📰' },
    { id: '3', title: 'Sources primaires', url: 'https://www.gouvernement.fr/ressources', snippet: 'Rapports académiques vérifiables.', domain: 'gouvernement.fr', date: 'Il y a 1 jour', fav: '📄' },
  ]
};

export function searchWeb(query: string, deep = false): WebSource[] {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Galaxies = priorité absolue (capture "galaxie", "galaxies", "hubble", "voie lactee", etc.)
  if (q.includes('galaxi') || q.includes('hubble') || q.includes('voie lactee') || q.includes('andromede') || q.includes('triangulum') || q.includes('elliptique') || q.includes('spirale') || q.includes('lenticulaire') || q.includes('irreguliere') || q.includes('naine') || q.includes('diapason')) {
    const base = [...MOCK_DB.espace];
    if (deep) {
      return [
        ...base,
        { id: '5', title: 'arXiv — Taxonomie des galaxies dwarfs & UDG', url: `https://arxiv.org/search/${encodeURIComponent(query)}`, snippet: 'Prépublication récente : UDG, naines sphéroïdales vs elliptiques naines, critères de distinction.', domain: 'arxiv.org', date: 'Il y a 6 jours', fav: '📑' },
        { id: '6', title: 'YouTube — Hubble Tuning Fork en 6 min', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, snippet: 'Vulgarisation avec schémas du diapason, exemples M87, M31, LMC.', domain: 'youtube.com', date: 'Il y a 2 jours', fav: '▶️' },
      ];
    }
    return deep ? base : base.slice(0, 3);
  }

  let base: WebSource[] = MOCK_DB.default;
  if (q.includes('ia') || q.includes('intelligence') || q.includes('gpt') || q.includes('claude') || q.includes('mistral') || q.includes('agent')) base = MOCK_DB.ia;
  else if (q.includes('quantique') || q.includes('qubit') || q.includes('physique') || q.includes('atome')) base = MOCK_DB.science;
  else if (q.includes('revolution') || q.includes('histoire') || q.includes('1789') || q.includes('napoleon')) base = MOCK_DB.histoire;
  else if (q.includes('espace') || q.includes('nasa') || q.includes('jwst') || q.includes('webb') || q.includes('univers') || q.includes('cosmos') || q.includes('etoile') || q.includes('planete')) base = MOCK_DB.espace;
  else if (q.includes('japon') || q.includes('kanji') || q.includes('jlpt') || q.includes('nihongo')) base = MOCK_DB.japonais;
  else {
    base = MOCK_DB.default.map((s, i) => ({
      ...s,
      title: i === 0 ? `Wikipédia — ${query.slice(0, 42)}` : s.title,
      snippet: i === 0 ? `Synthèse pour « ${query} » : définition, contexte, sources recoupées.` : s.snippet,
    }));
  }
  if (!deep) return base.slice(0, 3);
  return [
    ...base,
    { id: '4', title: 'arXiv — Prépublication récente', url: `https://arxiv.org/search/${encodeURIComponent(query)}`, snippet: 'Article avec méthodo et limites discutées.', domain: 'arxiv.org', date: 'Il y a 6 jours', fav: '📑' },
    { id: '5', title: 'YouTube — Vulgarisation experte', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, snippet: 'Vidéo avec schémas et exemples.', domain: 'youtube.com', date: 'Il y a 2 jours', fav: '▶️' },
  ];
}

export function transcribeMock(url: string) {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace('www.', '');
    return {
      title: `Retranscription — ${domain}${u.pathname.slice(0, 32)}`,
      content: `Contenu extrait de ${url} (simulateur).\n\nPoints clés :\n• Idée centrale fidèlement reformulée.\n• Faits chiffrés recoupés.\n→ Comme ChatGPT/Claude browsing.`,
      sources: searchWeb(domain + ' ' + (u.pathname.split('/').pop() || ''), false),
    };
  } catch {
    return { title: 'Retranscription', content: `Retranscription de « ${url} ».`, sources: searchWeb(url, false) };
  }
}
