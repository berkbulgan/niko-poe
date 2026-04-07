// ABOUTME: Loads and caches GGG atlas tree sprite sheets for Canvas rendering.
// ABOUTME: Selects the appropriate zoom-level sprite, resolves coords, and draws cropped sprites.

import type { AtlasSprites, SpriteCategory, SpriteCoord, SpriteZoomEntry } from '@/types/atlas-tree';

// ---------------------------------------------------------------------------
// Image cache — keyed by URL, shared across all sprite categories
// ---------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);

  const existing = loadingPromises.get(url);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      loadingPromises.delete(url);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(url);
      reject(new Error(`Failed to load sprite: ${url}`));
    };
    img.src = url;
  });

  loadingPromises.set(url, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Zoom level selection
// ---------------------------------------------------------------------------

/** Available zoom levels from GGG data, sorted ascending. */
let sortedZoomLevels: number[] = [];
/** Maps zoom level number to its string key in sprite data. */
let zoomKeyMap = new Map<number, string>();

export function initZoomLevels(_imageZoomLevels: number[], sprites: AtlasSprites): void {
  // GGG sprites have one extra zoom level (0.5) beyond imageZoomLevels
  const allZooms = new Set<string>();
  const sample: SpriteCategory = sprites.normalActive;
  for (const key of Object.keys(sample)) {
    allZooms.add(key);
  }

  const parsed = Array.from(allZooms).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  sortedZoomLevels = parsed;
  zoomKeyMap = new Map(parsed.map((z) => [z, String(z)]));
}

/**
 * Picks the best zoom level for the current canvas zoom.
 * Selects the smallest zoom level that is >= current zoom, or the largest if
 * current zoom exceeds all levels.
 */
export function pickZoomLevel(currentZoom: number): string {
  for (const level of sortedZoomLevels) {
    if (level >= currentZoom) {
      return zoomKeyMap.get(level) ?? String(level);
    }
  }
  const last = sortedZoomLevels[sortedZoomLevels.length - 1];
  return zoomKeyMap.get(last) ?? String(last);
}

// ---------------------------------------------------------------------------
// Sprite resolution — convert CDN URLs to local /atlas/ paths
// ---------------------------------------------------------------------------

/**
 * GGG sprite filenames are CDN URLs like:
 *   https://web.poecdn.com/image/passive-skill/atlas-skills-0.jpg?hash
 * We serve them locally from /atlas/atlas-skills-0.jpg.
 */
function toLocalUrl(cdnUrl: string): string {
  try {
    const url = new URL(cdnUrl);
    const filename = url.pathname.split('/').pop() ?? '';
    return `/atlas/${filename}`;
  } catch {
    return cdnUrl;
  }
}

// ---------------------------------------------------------------------------
// Sprite drawing
// ---------------------------------------------------------------------------

export interface SpriteRef {
  image: HTMLImageElement;
  coord: SpriteCoord;
}

/**
 * Resolves a sprite reference from a category at a given zoom level.
 * Returns null if the sprite isn't loaded yet (non-blocking).
 */
export function resolveSprite(
  category: SpriteCategory,
  spriteName: string,
  zoomKey: string,
): { entry: SpriteZoomEntry; coord: SpriteCoord; localUrl: string } | undefined {
  const entry = category[zoomKey];
  if (!entry) return undefined;

  const coord = entry.coords[spriteName];
  if (!coord) return undefined;

  return { entry, coord, localUrl: toLocalUrl(entry.filename) };
}

/**
 * Draws a sprite onto a canvas context.
 * Centers the sprite at (cx, cy) in world coordinates.
 * Returns false if the image isn't loaded yet.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  category: SpriteCategory,
  spriteName: string,
  zoomKey: string,
  cx: number,
  cy: number,
  scale: number,
): boolean {
  const resolved = resolveSprite(category, spriteName, zoomKey);
  if (!resolved) return false;

  const img = imageCache.get(resolved.localUrl);
  if (!img) return false;

  const { coord } = resolved;
  const dw = coord.w * scale;
  const dh = coord.h * scale;

  ctx.drawImage(
    img,
    coord.x, coord.y, coord.w, coord.h,
    cx - dw / 2, cy - dh / 2, dw, dh,
  );
  return true;
}

/**
 * Draws a sprite stretched to fill a specific width/height, centered at (cx, cy).
 */
export function drawSpriteRect(
  ctx: CanvasRenderingContext2D,
  category: SpriteCategory,
  spriteName: string,
  zoomKey: string,
  cx: number,
  cy: number,
  destW: number,
  destH: number,
): boolean {
  const resolved = resolveSprite(category, spriteName, zoomKey);
  if (!resolved) return false;

  const img = imageCache.get(resolved.localUrl);
  if (!img) return false;

  const { coord } = resolved;
  ctx.drawImage(
    img,
    coord.x, coord.y, coord.w, coord.h,
    cx - destW / 2, cy - destH / 2, destW, destH,
  );
  return true;
}

// ---------------------------------------------------------------------------
// Preloading
// ---------------------------------------------------------------------------

/**
 * Preloads all sprite sheets for a given zoom level.
 * Returns a promise that resolves when all images are loaded.
 */
export function preloadSprites(sprites: AtlasSprites, zoomKey: string): Promise<void> {
  const urls = new Set<string>();

  for (const category of Object.values(sprites)) {
    const entry = (category as SpriteCategory)[zoomKey];
    if (entry) {
      urls.add(toLocalUrl(entry.filename));
    }
  }

  // Also preload the highest zoom for mastery overlay (always at "1")
  const masteryOverlay = sprites.masteryOverlay['1'];
  if (masteryOverlay) {
    urls.add(toLocalUrl(masteryOverlay.filename));
  }

  return Promise.all(Array.from(urls).map(loadImage)).then(() => undefined);
}

/**
 * Preloads sprites for multiple zoom levels.
 */
export function preloadAllZoomLevels(sprites: AtlasSprites): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const zoomKey of zoomKeyMap.values()) {
    promises.push(preloadSprites(sprites, zoomKey));
  }
  return Promise.all(promises).then(() => undefined);
}

/**
 * Check if a specific sprite sheet image is loaded.
 */
export function isSpriteLoaded(category: SpriteCategory, zoomKey: string): boolean {
  const entry = category[zoomKey];
  if (!entry) return false;
  return imageCache.has(toLocalUrl(entry.filename));
}
