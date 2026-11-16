import type { Camera, ViewportSize } from './types';

export const ZOOM_MIN = 1e-12;
export const ZOOM_MAX = 1e12;

export function screenToWorld(sx: number, sy: number, camera: Camera, viewport: ViewportSize) {
  return {
    x: (sx - viewport.width / 2) / camera.zoom + camera.x,
    y: (sy - viewport.height / 2) / camera.zoom + camera.y,
  };
}

export function worldToScreen(wx: number, wy: number, camera: Camera, viewport: ViewportSize) {
  return {
    x: (wx - camera.x) * camera.zoom + viewport.width / 2,
    y: (wy - camera.y) * camera.zoom + viewport.height / 2,
  };
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface CameraAnimation {
  from: Camera; to: Camera; startTime: number; duration: number; onComplete?: () => void;
}

export function createFlyTo(from: Camera, targetX: number, targetY: number, targetZoom: number, duration = 900): CameraAnimation {
  return { from: { ...from }, to: { x: targetX, y: targetY, zoom: clampZoom(targetZoom) }, startTime: performance.now(), duration };
}

export function tickAnimation(anim: CameraAnimation, now: number): { camera: Camera; done: boolean } {
  const t = Math.min(1, (now - anim.startTime) / anim.duration);
  const e = easeInOutCubic(t);
  return {
    camera: {
      x: anim.from.x + (anim.to.x - anim.from.x) * e,
      y: anim.from.y + (anim.to.y - anim.from.y) * e,
      zoom: anim.from.zoom + (anim.to.zoom - anim.from.zoom) * e,
    },
    done: t >= 1,
  };
}

export function getVisibleBounds(camera: Camera, viewport: ViewportSize, padding = 200) {
  const halfW = viewport.width / (2 * camera.zoom) + padding / camera.zoom;
  const halfH = viewport.height / (2 * camera.zoom) + padding / camera.zoom;
  return { minX: camera.x - halfW, maxX: camera.x + halfW, minY: camera.y - halfH, maxY: camera.y + halfH };
}

export function zoomToFitNode(nodeScale: number, viewport: ViewportSize, ratio = 0.28, baseRadius = 104): number {
  const worldR = baseRadius * nodeScale;
  const targetPx = Math.min(viewport.width, viewport.height) * ratio;
  return clampZoom(targetPx / Math.max(worldR, 1e-15));
}

/**
 * Navigation flèches / Entrée : cadre le concept à l'écran.
 * Ratio modéré (moins agressif que le double-clic) mais recentre bien le zoom.
 */
export function zoomForNavigation(
  nodeScale: number,
  viewport: ViewportSize,
  _currentZoom?: number,
  ratio = 0.17
): number {
  return zoomToFitNode(nodeScale, viewport, ratio);
}

export function formatZoom(zoom: number): string {
  if (zoom >= 1000 || zoom < 0.001) return zoom.toExponential(1);
  if (zoom >= 10) return `${Math.round(zoom)}×`;
  if (zoom >= 1) return `${zoom.toFixed(1)}×`;
  if (zoom >= 0.01) return `${(zoom * 100).toFixed(1)}%`;
  return zoom.toExponential(1);
}
