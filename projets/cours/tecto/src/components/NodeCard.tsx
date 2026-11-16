import {
  Atom, BookOpen, Bot, Brain, Circle, Code, Cpu, Database, Dices, Dna, Eye, Flame,
  FlaskConical, GitBranch, GitMerge, Globe, GraduationCap, Heart, Image,
  Infinity as InfinityIcon, Layers, Leaf, MessageSquare, MousePointer, Music,
  Network, Orbit, Palette, PenTool, Plus, Share2, Shield, Sigma, Sparkles, Timer,
  TrendingUp, Type, Users, Waves, Zap, type LucideIcon,
} from 'lucide-react';
import { memo } from 'react';
import type { KnowledgeNode } from '../lib/types';

const ICONS: Record<string, LucideIcon> = {
  atom: Atom, 'book-open': BookOpen, bot: Bot, brain: Brain, circle: Circle, code: Code,
  cpu: Cpu, database: Database, dices: Dices, dna: Dna, eye: Eye, flame: Flame, flask: FlaskConical,
  'git-branch': GitBranch, 'git-merge': GitMerge, globe: Globe, 'graduation-cap': GraduationCap,
  heart: Heart, image: Image, infinity: InfinityIcon, layers: Layers, leaf: Leaf,
  'message-square': MessageSquare, 'mouse-pointer': MousePointer, music: Music, network: Network,
  orbit: Orbit, palette: Palette, 'pen-tool': PenTool, 'share-2': Share2, shield: Shield,
  sigma: Sigma, sparkles: Sparkles, timer: Timer, 'trending-up': TrendingUp, type: Type,
  users: Users, waves: Waves, zap: Zap,
};
export const ICON_OPTIONS = Object.keys(ICONS);

interface Props {
  node: KnowledgeNode;
  screenSize: number;
  selected: boolean;
  highlighted: boolean;
  zoom: number;
  onAddChild?: (parentId: string) => void;
  /** Mindmap 2D: title inside the block (outside only when image present) */
  titleInside?: boolean;
}

export const NodeCard = memo(function NodeCard({
  node,
  screenSize,
  selected,
  highlighted,
  onAddChild,
  titleInside = false,
}: Props) {
  const Icon = ICONS[node.icon] || Circle;
  const size = Math.max(4, Math.min(screenSize, 480));
  const wF = Math.min(3, Math.max(0.4, node.wFactor ?? 1));
  const hF = Math.min(3, Math.max(0.4, node.hFactor ?? 1));
  const boxW = Math.max(4, size * wF);
  const boxH = Math.max(4, size * hF);
  const minSide = Math.min(boxW, boxH);
  const showLabel = minSide >= 22;
  const showDesc = minSide >= 70 && !!node.description;
  const showTags = minSide >= 110 && node.tags.length > 0;
  const showAdd = minSide >= 36 && !!onAddChild;
  const showImage = minSide >= 40 && !!node.imageUrl;
  const iconSize = Math.max(8, Math.min(minSide * 0.34, 56));
  const displayTitle = node.title.trim() || 'Sans titre';
  const isPrimary = !!node.isPrimary;
  const segments: string[] | null = ((node as unknown as { colorSegments?: string[] }).colorSegments && (node as unknown as { colorSegments?: string[] }).colorSegments!.length > 1 ? (node as unknown as { colorSegments?: string[] }).colorSegments as string[] : null);

  // 2D mindmap: title inside block unless there is an image
  const putTitleInside = titleInside && showLabel && !showImage;
  const putTitleOutside = showLabel && (!titleInside || showImage);

  if (minSide < 28) {
    const r = Math.max(3, minSide * 0.55);
    if (segments) {
      const segs = segments;
      const grad = `conic-gradient(from 0deg, ${segs.map((c, i) => `${c} ${(i / segs.length) * 100}% ${( (i+1)/segs.length)*100}%`).join(', ')})`;
      return (
        <div
          className="rounded-full transition-shadow duration-150"
          title={`${displayTitle}${isPrimary ? ' · principal' : ''} · ${segs.length} couleurs`}
          style={{
            width: r * wF,
            height: r * hF,
            background: grad,
            boxShadow: selected ? `0 0 0 2px #ffffff88, 0 0 16px ${segs[0]}99` : `0 0 10px ${segs[0]}55`,
            border: selected ? `1.5px solid white` : undefined,
          }}
        />
      );
    }
    return (
      <div
        className="rounded-full transition-shadow duration-150"
        title={displayTitle + (isPrimary ? ' · principal' : '')}
        style={{
          width: r * wF,
          height: r * hF,
          background: node.color,
          boxShadow: selected
            ? `0 0 0 2px ${node.color}66, 0 0 16px ${node.color}99`
            : isPrimary
              ? '0 0 0 2px #fbbf24aa, 0 0 14px #f59e0b88'
              : `0 0 10px ${node.color}55`,
        }}
      />
    );
  }

  const radius = Math.min(boxW, boxH) < 48 ? 12 : 16;
  const titleFs = Math.max(11, Math.min(titleInside ? 18 : 26, minSide * (titleInside ? 0.16 : 0.22)));

  return (
    <div
      className="flex flex-col items-center gap-1.5 group/card"
      style={{
        width: Math.max(
          boxW,
          putTitleOutside && showDesc ? Math.min(280, boxW * 1.15) : boxW
        ),
      }}
    >
      <div
        className="relative flex flex-col items-center justify-center transition-shadow duration-150 overflow-hidden"
        style={{
          width: boxW,
          height: boxH,
          borderRadius: radius,
          background: segments
            ? `conic-gradient(from 0deg, ${segments.map((c, i) => `${c} ${(i / segments.length) * 100}% ${((i+1)/segments.length)*100}%`).join(', ')})`
            : showImage
            ? undefined
            : `linear-gradient(145deg, ${node.color}36, ${node.color}12)`,
          border: segments
            ? `1.5px solid ${segments[0]}`
            : isPrimary
            ? '2px solid #fbbf24'
            : `1.5px solid ${selected || highlighted ? node.color : `${node.color}55`}`,
          boxShadow: segments && selected
            ? `0 0 0 3px ${segments[0]}40, 0 8px 32px ${segments[0]}33`
            : selected
            ? `0 0 0 3px ${node.color}40, 0 8px 32px ${node.color}33, 0 0 60px ${node.color}22`
            : isPrimary
              ? '0 0 0 2px #fbbf2433, 0 0 28px #f59e0b44, 0 4px 16px rgba(0,0,0,0.35)'
              : highlighted
                ? `0 0 0 2px ${node.color}30, 0 4px 20px ${node.color}25`
                : '0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: minSide > 80 && !showImage && screenSize > 60 ? 'blur(8px)' : undefined,
          padding: putTitleInside ? Math.max(6, minSide * 0.08) : undefined,
        }}
      >
        {isPrimary && minSide >= 40 && (
          <div
            className="absolute top-1 left-1 z-[2] px-1 py-0.5 rounded text-[8px] font-bold"
            style={{ background: 'rgba(251,191,36,0.9)', color: '#1a1200' }}
          >
            ★
          </div>
        )}
        {showImage && (
          <>
            <img
              src={node.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, transparent 40%, ${node.color}55 100%)`,
              }}
            />
          </>
        )}
        {!showImage && !putTitleInside && minSide < 120 && (
          <div
            className="absolute opacity-40 blur-md pointer-events-none"
            style={{
              inset: minSide * 0.12,
              borderRadius: radius - 4,
              background: node.color,
            }}
          />
        )}
        {minSide >= 32 && !showImage && !putTitleInside && (
          <Icon
            size={iconSize}
            style={{ color: node.color, position: 'relative', zIndex: 1 }}
            strokeWidth={1.6}
          />
        )}

        {putTitleInside && (
          <div
            className="relative z-[1] flex flex-col items-center justify-center text-center w-full h-full gap-1 pointer-events-none"
            title={displayTitle}
          >
            {minSide >= 48 && (
              <Icon
                size={Math.max(12, Math.min(iconSize * 0.7, minSide * 0.22))}
                style={{ color: node.color, flexShrink: 0 }}
                strokeWidth={1.6}
              />
            )}
            <div
              className={`font-semibold tracking-tight leading-tight px-0.5 ${
                node.title.trim() ? 'text-white/95' : 'text-white/35 italic'
              }`}
              style={{
                fontSize: titleFs,
                textShadow: '0 1px 8px rgba(0,0,0,0.85)',
                display: '-webkit-box',
                WebkitLineClamp: minSide < 70 ? 2 : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {displayTitle}
            </div>
            {showDesc && minSide >= 90 && (
              <div
                className="text-white/50 leading-snug line-clamp-2 px-0.5"
                style={{ fontSize: Math.max(9, Math.min(12, size * 0.1)) }}
              >
                {node.description}
              </div>
            )}
          </div>
        )}

        {showAdd && (
          <button
            type="button"
            data-node-action="add-child"
            title="Créer un concept lié"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAddChild?.(node.id);
            }}
            className={`absolute z-10 flex items-center justify-center rounded-full border border-white/20 bg-[#12121a]/90 text-white/80 shadow-lg hover:bg-violet-500/40 hover:text-white hover:scale-110 ${
              selected || minSide >= 80
                ? 'opacity-100'
                : 'opacity-0 group-hover/card:opacity-100'
            }`}
            style={{
              width: Math.max(18, Math.min(28, minSide * 0.28)),
              height: Math.max(18, Math.min(28, minSide * 0.28)),
              right: -6,
              top: -6,
            }}
          >
            <Plus size={Math.max(10, Math.min(14, minSide * 0.14))} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {putTitleOutside && (
        <div className="text-center max-w-[280px] pointer-events-none">
          <div
            className={`font-semibold tracking-tight leading-tight ${
              node.title.trim() ? 'text-white/95' : 'text-white/35 italic'
            }`}
            style={{
              fontSize: Math.max(13, Math.min(26, minSide * 0.22)),
              textShadow: '0 1px 10px rgba(0,0,0,0.9)',
            }}
          >
            {displayTitle}
          </div>
          {showDesc && (
            <div
              className="mt-1 text-white/55 leading-snug line-clamp-2"
              style={{ fontSize: Math.max(11, Math.min(16, minSide * 0.13)) }}
            >
              {node.description}
            </div>
          )}
          {showTags && (
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {node.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded-md text-[9px] font-medium"
                  style={{
                    background: `${node.color}22`,
                    color: node.color,
                    border: `1px solid ${node.color}33`,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
