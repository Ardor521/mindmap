
import { useMemo } from 'react';
import type { Camera, KnowledgeNode, ViewportSize } from '../lib/types';

const W = 168, H = 112;

export function Minimap({ nodes, camera, viewport, onNavigate, selectedId }: {
  nodes: KnowledgeNode[]; camera: Camera; viewport: ViewportSize;
  onNavigate: (x: number, y: number) => void; selectedId: string | null;
}) {
  const bounds = useMemo(() => {
    if (!nodes.length) return { minX: -500, maxX: 500, minY: -500, maxY: 500 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    const pad = 200;
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  }, [nodes]);
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(W / bw, H / bh);
  const toMini = (x: number, y: number) => ({ x: (x - bounds.minX) * scale, y: (y - bounds.minY) * scale });
  const viewHalfW = viewport.width / (2 * camera.zoom);
  const viewHalfH = viewport.height / (2 * camera.zoom);
  const tl = toMini(camera.x - viewHalfW, camera.y - viewHalfH);
  const br = toMini(camera.x + viewHalfW, camera.y + viewHalfH);

  return (
    <div className="rounded-xl border border-white/10 bg-[#12121a]/90 backdrop-blur-xl shadow-2xl overflow-hidden cursor-crosshair"
      style={{ width: W, height: H }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onNavigate((e.clientX - rect.left) / scale + bounds.minX, (e.clientY - rect.top) / scale + bounds.minY);
      }} title="Mini-carte">
      <svg width={W} height={H} className="block">
        <rect width={W} height={H} fill="#0c0c12" />
        {nodes.map((n) => {
          const p = toMini(n.x, n.y);
          const r = n.depth === 0 ? 3.5 : n.depth === 1 ? 2.2 : 1.4;
          return <circle key={n.id} cx={p.x} cy={p.y} r={selectedId === n.id ? r + 1.5 : r} fill={n.color} opacity={selectedId === n.id ? 1 : 0.7} />;
        })}
        <rect x={tl.x} y={tl.y} width={Math.max(4, br.x - tl.x)} height={Math.max(4, br.y - tl.y)}
          fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.6)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
}
