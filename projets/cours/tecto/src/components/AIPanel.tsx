import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  X,
  Loader2,
  Network,
  GitBranch,
  Copy,
  BarChart3,
  Waypoints,
  Baby,
  HelpCircle,
  Trash2,
  Globe,
  Link as LinkIcon,
  Brain,
  Plus,
  ExternalLink,
  Wand2,
  Search,
  BookOpen,
  Layers,
  Check,
  Eye,
} from 'lucide-react';
import type { AIMessage, GraphData, KnowledgeNode } from '../lib/types';
import { streamAssistantReply, graphStats, generateWebSubConcepts } from '../lib/ai';
import type { WebSource } from '../lib/webSearch';

const SUGGESTIONS: { label: string; prompt: string; icon: typeof Sparkles; web?: boolean }[] = [
  { label: 'Résumer', prompt: 'Résume ce concept et son voisinage', icon: Sparkles },
  { label: 'Web : actualités', prompt: 'Cherche sur le web les dernières actualités sur ce concept', icon: Globe, web: true },
  { label: 'Retranscrire URL', prompt: 'Retranscris : https://fr.wikipedia.org/wiki/Intelligence_artificielle', icon: LinkIcon, web: true },
  { label: 'Mindmap web', prompt: 'Crée une mindmap sur ce concept à partir du web', icon: Layers, web: true },
  { label: 'Sous-concepts', prompt: 'Génère des sous-concepts', icon: Baby },
  { label: 'Connexions', prompt: 'Suggère des connexions pertinentes', icon: GitBranch },
  { label: 'Analyse', prompt: 'Analyse le graphe', icon: BarChart3 },
  { label: 'Doublons', prompt: 'Détecte les doublons', icon: Copy },
  { label: 'Isolés', prompt: 'Liste les concepts isolés', icon: Network },
  { label: 'Aide', prompt: 'Aide', icon: HelpCircle },
];

function renderMarkdownLite(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (/^\|?\s*-+/.test(line.replace(/\|/g, '').trim()) || line.includes('---')) return null;
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      return (
        <div key={i} className="flex gap-2 text-[11px] text-white/60 font-mono py-0.5">
          {cells.map((c, j) => (<span key={j} className="min-w-0 truncate">{c.replace(/\*\*(.+?)\*\*/g, '$1')}</span>))}
        </div>
      );
    }
    const html = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>').replace(/_(.+?)_/g, '<em class="text-white/50">$1</em>').replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-[11px] text-violet-200">$1</code>');
    if (line.startsWith('## ')) return (<h3 key={i} className="text-sm font-semibold text-violet-100 mt-1 mb-0.5" dangerouslySetInnerHTML={{ __html: line.slice(3).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />);
    if (line.startsWith('### ')) return (<h4 key={i} className="text-[13px] font-semibold text-white/85 mt-1" dangerouslySetInnerHTML={{ __html: line.slice(4).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />);
    if (line.startsWith('---')) return <div key={i} className="h-px bg-white/10 my-2" />;
    // detect citation line [1] Title — domain
    if (/^\[\d+\]/.test(line.trim())) {
      const m = line.trim().match(/^\[(\d+)\]\s*(.+?)\s*—\s*(.+?)(?:\s*\(|$)/);
      if (m) {
        const n = m[1], title = m[2], domain = m[3];
        return (<div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-white/[0.04] border border-white/5"><span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold grid place-items-center shrink-0">{n}</span><span className="truncate text-white/70">{title}</span><span className="ml-auto text-[11px] text-white/30 hidden sm:inline">{domain}</span></div>);
      }
    }
    if (line.startsWith('• ') || line.startsWith('- ') || /^\d+\.\s/.test(line)) return (<div key={i} className="pl-2 text-sm text-white/70 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />);
    if (!line.trim()) return <div key={i} className="h-2" />;
    return (<p key={i} className="text-sm text-white/70 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />);
  });
}

export function AIPanel({
  open,
  onClose,
  graph,
  contextNode,
  onExpandAI,
}: {
  open: boolean;
  onClose: () => void;
  graph: GraphData;
  contextNode: KnowledgeNode | null;
  onExpandAI: (id: string) => void;
}) {
  const [messages, setMessages] = useState<AIMessage[]>([
    { id: 'welcome', role: 'assistant', content: "Bonjour — je suis l'assistant **Knowledge Universe 2.0** ✨\n\n**2 modes combinés :** 📂 Graphe local + 🌐 Web temps réel (comme ChatGPT/Claude).\n\n**Nouveau :**\n• 🌐 Recherche web sourcée [1][2] avec recoupement\n• 🔗 Retranscris une URL (colle `https://...`)\n• 🧠 Mindmap depuis le web → “Crée une mindmap sur le système solaire (web)”\n\n_Sélectionne un nœud pour un contexte hybride précis, ou tape une question web directement._", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [webEnabled, setWebEnabled] = useState(true);
  const [deepEnabled, setDeepEnabled] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [lastSources, setLastSources] = useState<WebSource[] | null>(null);
  const [lastWebReasoning, setLastWebReasoning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(0);

  const stats = useMemo(() => graph.nodes?.length ? graphStats(graph) : { nodes: 0, edges: 0, orphans: 0, components: 0, avgDegree: 0, maxDepth: 0, density: 0 }, [graph]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, lastSources]);

  if (!open) return null;

  const handleCreateMindmapFromWeb = (query: string) => {
    if (!contextNode) return;
    // Génère 6 sous-concepts depuis le web et les place via le store
    const subs = generateWebSubConcepts(query || contextNode.title, deepEnabled, contextNode);
    // On passe par un hack : stock temporaire puis expand custom
    (window as any).__kuWebSubs = subs;
    // Dispatch via event to EditorApp
    window.dispatchEvent(new CustomEvent('ku:web-mindmap', { detail: { parentId: contextNode.id, query, deep: deepEnabled } }));
    setMessages(m => [...m, { id: `sys-${Date.now()}`, role: 'assistant', content: `✅ **Mindmap web en création** : 6 branches sourcées ajoutées autour de **${contextNode.title}**.\n\n_Zoome pour explorer — chaque branche est un nœud éditable._`, timestamp: Date.now() } as AIMessage]);
  };

  const handleAddSourcesToCanvas = () => {
    if (!lastSources || !contextNode) return;
    const baseQuery = messages[messages.length - 1]?.content.slice(0, 40) || contextNode.title;
    handleCreateMindmapFromWeb(baseQuery);
  };

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || streaming) return;
    setInput('');
    const userMsg: AIMessage = { id: `u-${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now() };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);
    setStreaming(true);
    setLastSources(null);
    setLastWebReasoning(null);
    const ticket = ++abortRef.current;
    try {
      const lower = prompt.toLowerCase();
      if (
        contextNode &&
        (lower.includes('ajoute les sous') || lower.includes('ajoute sous') || lower.includes('crée les sous') || lower.includes('creer les sous') || lower.includes('expand now') || lower.includes('place les sous') || (lower.includes('génère') && lower.includes('ajoute')) || (lower.includes('genere') && lower.includes('ajoute')))
      ) {
        try { onExpandAI(contextNode.id); } catch { }
      }
      // Si c'est une demande mindmap web explicite
      const isMindmapWeb = /mindmap|carte mentale|carte heuristique/i.test(prompt);
      if (isMindmapWeb && contextNode && webEnabled) {
        // On laisse streamAssistantReply générer la description, puis on crée la map à la fin
        await streamAssistantReply(prompt, { ...graph, nodes: graph.nodes ?? [], edges: graph.edges ?? [] }, contextNode, (chunk) => {
          if (abortRef.current !== ticket) return;
          setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, content: chunk || '…' } : msg));
        }, { webEnabled, deepEnabled });
        // auto-création après réponse
        if (abortRef.current === ticket) {
          setTimeout(() => handleCreateMindmapFromWeb(prompt), 400);
        }
        // capture sources side-channel
        const src = (globalThis as any).__kuLastWebSources as WebSource[] | undefined;
        const rsn = (globalThis as any).__kuLastWebReasoning as string | undefined;
        if (src) setLastSources(src);
        if (rsn) setLastWebReasoning(rsn);
        return;
      }

      await streamAssistantReply(prompt, { ...graph, nodes: graph.nodes ?? [], edges: graph.edges ?? [] }, contextNode, (chunk) => {
        if (abortRef.current !== ticket) return;
        setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, content: chunk || '…' } : msg));
      }, { webEnabled, deepEnabled });
      const src = (globalThis as any).__kuLastWebSources as WebSource[] | undefined;
      const rsn = (globalThis as any).__kuLastWebReasoning as string | undefined;
      if (src) setLastSources(src);
      if (rsn) setLastWebReasoning(rsn);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de l'assistant.";
      if (abortRef.current === ticket) setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, content: `⚠️ ${message}` } : msg));
    } finally {
      if (abortRef.current === ticket) setStreaming(false);
    }
  };

  const clearChat = () => {
    abortRef.current++; setStreaming(false); setLastSources(null); setLastWebReasoning(null);
    setMessages([{ id: 'welcome-clear', role: 'assistant', content: 'Conversation effacée. Pose une nouvelle question (graphe ou web).', timestamp: Date.now() }]);
  };

  return (
    <aside className="fixed top-20 left-4 bottom-4 w-[min(400px,calc(100vw-2rem))] z-[90] flex flex-col rounded-2xl border border-white/10 bg-[#0F0F14]/98 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-black/40">
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-gradient-to-r from-violet-600/10 via-transparent to-transparent">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 border border-white/10 flex items-center justify-center shadow">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white flex items-center gap-1.5">Assistant IA 2.0 <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-bold">WEB</span></div>
          <div className="text-[11px] text-white/45 truncate">
            {contextNode ? `Contexte : ${contextNode.title || 'Sans titre'}` : 'Aucun nœud sélectionné'} <span className="text-white/20">· {stats.nodes}n · {stats.edges}l{stats.orphans > 0 ? ` · ${stats.orphans} isolé(s)` : ''}</span>
          </div>
        </div>
        <button type="button" onClick={clearChat} title="Effacer" className="p-1.5 rounded-lg text-white/30 hover:bg-white/8 hover:text-white/60"><Trash2 size={14} /></button>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:bg-white/8"><X size={16} /></button>
      </div>

      <div className="px-3 py-2 border-b border-white/5 bg-[#0A0A0F] flex flex-wrap gap-2 items-center">
        <button onClick={() => setWebEnabled(!webEnabled)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border transition ${webEnabled ? 'bg-emerald-500 border-emerald-500 text-white shadow' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
          <Globe size={12} /> Web {webEnabled ? 'ON' : 'OFF'} <span className={`w-7 h-4 rounded-full p-0.5 flex items-center ${webEnabled ? 'bg-white/20 justify-end' : 'bg-zinc-700 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white" /></span>
        </button>
        <button onClick={() => setDeepEnabled(!deepEnabled)} className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-bold border ${deepEnabled ? 'bg-violet-600 border-violet-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
          <Eye size={12} /> {deepEnabled ? 'Deep 5 src' : 'Rapide 3 src'}
        </button>
        <button onClick={() => setShowReasoning(!showReasoning)} className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${showReasoning ? 'bg-white text-black border-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
          <Brain size={12} /> {showReasoning ? 'Raisonnement' : 'Raisonnement'}
        </button>
      </div>

      {lastWebReasoning && showReasoning && (
        <div className="mx-3 mt-2 rounded-xl bg-violet-950/40 border border-violet-800/40 p-2.5">
          <div className="text-[11px] font-bold tracking-widest text-violet-300 flex items-center gap-1"><Brain size={11} /> RAISONNEMENT IA</div>
          <div className="text-xs leading-relaxed text-violet-200/70 mt-1 font-mono">{lastWebReasoning}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${m.role === 'user' ? 'bg-violet-600 text-white text-sm shadow' : 'bg-white/[0.06] border border-white/10'}`}>
              {m.role === 'assistant' ? (m.content ? renderMarkdownLite(m.content) : <Loader2 size={14} className="animate-spin text-violet-300" />) : <span className="text-sm leading-relaxed">{m.content}</span>}
            </div>
          </div>
        ))}
        {lastSources && lastSources.length > 0 && (
          <div className="rounded-2xl bg-[#15151C] border border-zinc-800 p-3">
            <div className="text-[11px] font-bold tracking-widest text-zinc-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Globe size={11} /> SOURCES WEB • {lastSources.length} VÉRIFIÉES</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Recoupées</span>
            </div>
            <div className="mt-2 grid gap-2">
              {lastSources.map(s => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition text-left">
                  <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 grid place-items-center text-[12px] shrink-0">{s.fav}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs font-medium leading-tight flex items-center gap-1 truncate">{s.title} <ExternalLink size={10} className="text-zinc-500 shrink-0" /></span>
                    <span className="text-[11px] leading-relaxed text-zinc-500 line-clamp-2">{s.snippet}</span>
                    <span className="text-[11px] text-zinc-600">{s.domain} · {s.date}</span>
                  </span>
                </a>
              ))}
            </div>
            {contextNode && (
              <div className="mt-3 flex gap-2">
                <button onClick={handleAddSourcesToCanvas} className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-100"><Plus size={12} /> Ajouter au canvas (6 nœuds sourcés)</button>
                <button onClick={() => send(`Retranscris en détail : ${lastSources[0]?.url || ''}`)} className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-medium hover:bg-zinc-700"><BookOpen size={12} className="inline mr-1" /> Détailler</button>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.prompt} type="button" onClick={() => send(contextNode ? s.prompt.replace('ce concept', `« ${contextNode.title} »`) : s.prompt)} disabled={streaming} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border transition ${s.web ? 'bg-violet-600/15 border-violet-500/30 text-violet-300 hover:bg-violet-600/25' : 'text-white/45 bg-white/4 border-white/8 hover:text-white/75 hover:bg-white/8'} disabled:opacity-40`}>
              <Icon size={11} className="opacity-70" />{s.label}
            </button>
          );
        })}
      </div>

      <form className="p-3 border-t border-white/10 flex gap-2 bg-[#0A0A0F]" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <div className="flex-1 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={webEnabled ? (contextNode ? `Question web ou graphe sur « ${contextNode.title} »…` : 'Question, URL à retranscrire ou “crée mindmap web : …”') : (contextNode ? `Question sur « ${contextNode.title} »…` : 'Question sur le graphe…')}
            disabled={streaming}
            className="w-full rounded-xl bg-white/5 border border-white/10 pl-3 pr-9 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-500/40 disabled:opacity-50"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20"><Search size={14} /></span>
        </div>
        <button type="submit" disabled={streaming || !input.trim()} className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 shadow"><Send size={16} /></button>
      </form>
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[11px] text-white/25">
        <span className={`w-2 h-2 rounded-full ${webEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} /> {webEnabled ? 'Web ON : comme ChatGPT/Claude — sources [1][2]' : 'Web OFF : graphe local seul'} · <span className="hidden sm:inline">Colle une URL pour retranscrire</span><span className="sm:hidden">Colle URL</span>
      </div>
    </aside>
  );
}
