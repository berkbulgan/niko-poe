// ABOUTME: Canvas-based atlas tree renderer using GGG sprite sheets.
// ABOUTME: Renders layers: background → group bg → connections → nodes → frames → start node.

import type {
  AtlasSprites,
  AtlasConnection,
  ProcessedAtlasNode,
  SpriteCategory,
} from '@/types/atlas-tree';
import {
  drawSprite,
  drawSpriteRect,
  pickZoomLevel,
  resolveSprite,
  type AssetUrl,
} from './atlas-sprite-loader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderState {
  nodes: ProcessedAtlasNode[];
  connections: AtlasConnection[];
  allocatedIds: Set<number>;
  allocatableIds: Set<string>;
  sprites: AtlasSprites;
  /** Sprite sheet file name → URL for this tree's atlas tag. */
  assetUrl: AssetUrl;
  /** Tree world-space bounds from GGG data. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Group data for rendering backgrounds. */
  groups: Record<string, { x: number; y: number; background?: { image: string; offsetX?: number; offsetY?: number } }>;
  /** Current zoom scale. */
  zoom: number;
  /** Pan offset in screen pixels. */
  panX: number;
  panY: number;
  /** Hovered node ID (for highlight). */
  hoveredNodeId: string | null;
  /** Search-matching node IDs. */
  searchMatchIds: Set<string>;
  /** Starting node IDs (connected to the hub). */
  startingNodeIds: Set<string>;
  /** World position of the start icon and the hub the starting nodes connect to. */
  startPosition: { x: number; y: number };
  /** Node IDs that would be allocated on click (path preview). */
  pathPreviewIds: Set<string>;
  /** Node IDs that would be deallocated on click (prune preview). */
  prunePreviewIds: Set<string>;
  /** Mastery group name being hovered (highlights all groups with same mastery). */
  hoveredMasteryName: string | null;
  /** Mastery name → list of node IDs mapping for cross-group highlight. */
  masteryGroupMap: Map<string, string[]>;
  /** Animation time in ms for blinking effects. */
  animTime: number;
  /** Viewport dimensions in screen pixels (for off-screen arrow calculation). */
  viewportWidth: number;
  viewportHeight: number;
}

// ---------------------------------------------------------------------------
// Node sizing (in world coordinates, before zoom)
// ---------------------------------------------------------------------------

// Radii derived from GGG frame sprite world-space sizes (sprite_px / zoom_level / 2)
const NODE_RADIUS: Record<string, number> = {
  keystone: 110,
  notable: 76,
  small: 51,
  mastery: 113,
  wormhole: 145,
};

export function getNodeWorldRadius(nodeType: string): number {
  return NODE_RADIUS[nodeType] ?? 26;
}

// ---------------------------------------------------------------------------
// Frame name resolution
// ---------------------------------------------------------------------------

function getFrameName(
  nodeType: string,
  isAllocated: boolean,
  isAllocatable: boolean,
): string {
  if (nodeType === 'wormhole') {
    if (isAllocated) return 'WormholeFrameAllocated';
    if (isAllocatable) return 'WormholeFrameCanAllocate';
    return 'WormholeFrameUnallocated';
  }
  if (nodeType === 'keystone') {
    if (isAllocated) return 'KeystoneFrameAllocated';
    if (isAllocatable) return 'KeystoneFrameCanAllocate';
    return 'KeystoneFrameUnallocated';
  }
  if (nodeType === 'notable') {
    if (isAllocated) return 'NotableFrameAllocated';
    if (isAllocatable) return 'NotableFrameCanAllocate';
    return 'NotableFrameUnallocated';
  }
  // Small passives
  if (isAllocated) return 'PSSkillFrameActive';
  if (isAllocatable) return 'PSSkillFrameHighlighted';
  return 'PSSkillFrame';
}

// ---------------------------------------------------------------------------
// Icon sprite category selection
// ---------------------------------------------------------------------------

function getIconCategory(
  sprites: AtlasSprites,
  nodeType: string,
  isAllocated: boolean,
): SpriteCategory {
  if (nodeType === 'mastery') return sprites.mastery;

  if (isAllocated) {
    if (nodeType === 'keystone') return sprites.keystoneActive;
    if (nodeType === 'notable') return sprites.notableActive;
    if (nodeType === 'wormhole') return sprites.wormholeActive;
    return sprites.normalActive;
  }
  if (nodeType === 'keystone') return sprites.keystoneInactive;
  if (nodeType === 'notable') return sprites.notableInactive;
  if (nodeType === 'wormhole') return sprites.wormholeInactive;
  return sprites.normalInactive;
}

// ---------------------------------------------------------------------------
// Connection line name
// ---------------------------------------------------------------------------

function getLineName(
  fromAllocated: boolean,
  toAllocated: boolean,
): string {
  if (fromAllocated && toAllocated) return 'LineConnectorActive';
  if (fromAllocated || toAllocated) return 'LineConnectorIntermediate';
  return 'LineConnectorNormal';
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderAtlasTree(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: RenderState,
): void {
  const { width, height } = canvas;
  const { zoom, panX, panY } = state;
  const zoomKey = pickZoomLevel(zoom);

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Dark background fill
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // 1. Atlas background
  drawAtlasBackground(ctx, state, zoomKey);

  // 2. Group backgrounds
  drawGroupBackgrounds(ctx, state, zoomKey);

  // 3. Start node decoration (behind connections)
  drawStartNode(ctx, state, zoomKey);

  // 4. Connection lines
  drawConnections(ctx, state);

  // 5. Node icons + frames
  drawNodes(ctx, state, zoomKey);

  ctx.restore();

  // 6. Off-screen arrows (drawn in screen space, after ctx.restore)
  drawOffScreenArrows(ctx, state);
}

// ---------------------------------------------------------------------------
// Layer: Atlas background
// ---------------------------------------------------------------------------

function drawAtlasBackground(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  zoomKey: string,
): void {
  const { bounds, sprites, assetUrl } = state;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  drawSpriteRect(
    ctx,
    sprites.atlasBackground,
    'AtlasPassiveBackground',
    zoomKey,
    cx, cy,
    w * 1.15, h * 1.15,
    assetUrl,
  );
}

// ---------------------------------------------------------------------------
// Layer: Group backgrounds
// ---------------------------------------------------------------------------

function drawGroupBackgrounds(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  zoomKey: string,
): void {
  const { groups, sprites, assetUrl } = state;

  for (const group of Object.values(groups)) {
    if (!group.background) continue;

    const bgName = group.background.image;
    const resolved = resolveSprite(sprites.groupBackground, bgName, zoomKey, assetUrl);
    if (!resolved) continue;

    const offsetX = group.background.offsetX ?? 0;
    const offsetY = group.background.offsetY ?? 0;

    // Scale factor: sprite coords are at the zoom level's scale,
    // we need to render at world-coordinate size (1/zoomLevel)
    const zoomLevel = parseFloat(zoomKey) || 0.3835;
    const invZoom = 1 / zoomLevel;

    drawSpriteRect(
      ctx,
      sprites.groupBackground,
      bgName,
      zoomKey,
      group.x + offsetX,
      group.y + offsetY,
      resolved.coord.w * invZoom,
      resolved.coord.h * invZoom,
      assetUrl,
    );
  }
}

// ---------------------------------------------------------------------------
// Layer: Start node
// ---------------------------------------------------------------------------

function drawStartNode(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  zoomKey: string,
): void {
  const zoomLevel = parseFloat(zoomKey) || 0.3835;
  const invZoom = 1 / zoomLevel;
  const resolved = resolveSprite(state.sprites.startNode, 'AtlasPassiveSkillScreenStart', zoomKey, state.assetUrl);
  const w = (resolved?.coord.w ?? 148) * invZoom;
  const h = (resolved?.coord.h ?? 154) * invZoom;

  drawSpriteRect(
    ctx,
    state.sprites.startNode,
    'AtlasPassiveSkillScreenStart',
    zoomKey,
    state.startPosition.x, state.startPosition.y,
    w, h,
    state.assetUrl,
  );
}

// ---------------------------------------------------------------------------
// Layer: Connections
// ---------------------------------------------------------------------------

function drawConnections(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  const { connections, allocatedIds, startingNodeIds, nodes, pathPreviewIds, prunePreviewIds } = state;

  // Draw hub-to-starting-node lines (from the start icon to each starting node)
  const nodeById = new Map<string, ProcessedAtlasNode>();
  for (const n of nodes) nodeById.set(n.id, n);

  for (const startId of startingNodeIds) {
    const startNode = nodeById.get(startId);
    if (!startNode) continue;

    const isAllocated = allocatedIds.has(startNode.skill);
    const isPathPreview = pathPreviewIds.has(startId);
    const isPrunePreview = prunePreviewIds.has(startId);

    ctx.beginPath();
    ctx.moveTo(state.startPosition.x, state.startPosition.y);
    ctx.lineTo(startNode.x, startNode.y);

    if (isPrunePreview) {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.6;
    } else if (isPathPreview) {
      ctx.strokeStyle = '#c8a862';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.7;
    } else if (isAllocated) {
      ctx.strokeStyle = '#c8a862';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.95;
    } else {
      ctx.strokeStyle = '#555850';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.65;
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Draw regular connections
  for (const conn of connections) {
    const fromAllocated = allocatedIds.has(conn.fromNode.skill);
    const toAllocated = allocatedIds.has(conn.toNode.skill);

    // Check preview states for this connection
    const fromPreviewPath = pathPreviewIds.has(conn.fromId);
    const toPreviewPath = pathPreviewIds.has(conn.toId);
    const fromPreviewPrune = prunePreviewIds.has(conn.fromId);
    const toPreviewPrune = prunePreviewIds.has(conn.toId);

    // Both ends in path preview, or one end preview + one end allocated → gold preview line
    const isPathLine =
      (fromPreviewPath && toPreviewPath) ||
      (fromPreviewPath && fromAllocated) || (toPreviewPath && fromAllocated) ||
      (fromPreviewPath && toAllocated) || (toPreviewPath && toAllocated);

    // Both ends in prune preview → red preview line
    const isPruneLine = fromPreviewPrune && toPreviewPrune;

    // Wormhole links: only draw when hovered or either end is allocated
    const isWormholeLink = conn.fromNode.isWormhole || conn.toNode.isWormhole;
    if (isWormholeLink) {
      const shouldShow =
        fromAllocated || toAllocated ||
        state.hoveredNodeId === conn.fromId ||
        state.hoveredNodeId === conn.toId ||
        fromPreviewPath || toPreviewPath;
      if (!shouldShow) continue;

      drawWormholeLink(ctx, conn, fromAllocated && toAllocated);
      continue;
    }

    if (isPruneLine) {
      drawPreviewLine(ctx, conn, '#e74c3c', 0.6, state);
    } else if (isPathLine) {
      drawPreviewLine(ctx, conn, '#c8a862', 0.7, state);
    } else {
      const lineName = getLineName(fromAllocated, toAllocated);
      if (conn.sameOrbit) {
        drawOrbitArc(ctx, conn, fromAllocated, toAllocated, state);
      } else {
        drawStraightLine(ctx, conn, lineName);
      }
    }
  }
}

function drawPreviewLine(
  ctx: CanvasRenderingContext2D,
  conn: AtlasConnection,
  color: string,
  alpha: number,
  state: RenderState,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  ctx.beginPath();

  if (conn.sameOrbit) {
    // Draw orbit arc
    const group = conn.arcCenter ?? state.groups[String(conn.fromNode.group)];
    if (group) {
      const cx = group.x;
      const cy = group.y;
      const radius = Math.sqrt(
        Math.pow(conn.fromNode.x - cx, 2) + Math.pow(conn.fromNode.y - cy, 2),
      );

      if (radius >= 1) {
        const startAngle = Math.atan2(conn.fromNode.y - cy, conn.fromNode.x - cx);
        const endAngle = Math.atan2(conn.toNode.y - cy, conn.toNode.x - cx);
        let diff = endAngle - startAngle;
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        ctx.arc(cx, cy, radius, startAngle, endAngle, diff < 0);
      } else {
        ctx.moveTo(conn.fromNode.x, conn.fromNode.y);
        ctx.lineTo(conn.toNode.x, conn.toNode.y);
      }
    } else {
      ctx.moveTo(conn.fromNode.x, conn.fromNode.y);
      ctx.lineTo(conn.toNode.x, conn.toNode.y);
    }
  } else {
    ctx.moveTo(conn.fromNode.x, conn.fromNode.y);
    ctx.lineTo(conn.toNode.x, conn.toNode.y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawStraightLine(
  ctx: CanvasRenderingContext2D,
  conn: AtlasConnection,
  lineName: string,
): void {
  const { fromNode, toNode } = conn;

  const isActive = lineName === 'LineConnectorActive';
  const isIntermediate = lineName === 'LineConnectorIntermediate';

  ctx.beginPath();
  ctx.moveTo(fromNode.x, fromNode.y);
  ctx.lineTo(toNode.x, toNode.y);

  if (isActive) {
    ctx.strokeStyle = '#c8a862';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.95;
  } else if (isIntermediate) {
    ctx.strokeStyle = '#7a6d3a';
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.75;
  } else {
    ctx.strokeStyle = '#555850';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.65;
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWormholeLink(
  ctx: CanvasRenderingContext2D,
  conn: AtlasConnection,
  bothAllocated: boolean,
): void {
  const { fromNode, toNode } = conn;

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([20, 12]);
  ctx.moveTo(fromNode.x, fromNode.y);
  ctx.lineTo(toNode.x, toNode.y);

  if (bothAllocated) {
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = '#9b59b6';
    ctx.shadowBlur = 8;
  } else {
    ctx.strokeStyle = '#7a5a9a';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = '#7a5a9a';
    ctx.shadowBlur = 6;
  }

  ctx.stroke();
  ctx.restore();
}

function drawOrbitArc(
  ctx: CanvasRenderingContext2D,
  conn: AtlasConnection,
  fromAllocated: boolean,
  toAllocated: boolean,
  state: RenderState,
): void {
  const { fromNode, toNode } = conn;

  // Both nodes are in the same group — draw an arc through the orbit
  const group = conn.arcCenter ?? state.groups[String(fromNode.group)];
  if (!group) {
    // Fallback to straight line
    const isActive = fromAllocated && toAllocated;
    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.strokeStyle = isActive ? '#c8a862' : '#555850';
    ctx.lineWidth = isActive ? 6 : 3;
    ctx.globalAlpha = isActive ? 0.95 : 0.65;
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  const cx = group.x;
  const cy = group.y;
  const radius = Math.sqrt(
    Math.pow(fromNode.x - cx, 2) + Math.pow(fromNode.y - cy, 2),
  );

  if (radius < 1) {
    // Degenerate — skip
    return;
  }

  const startAngle = Math.atan2(fromNode.y - cy, fromNode.x - cx);
  const endAngle = Math.atan2(toNode.y - cy, toNode.x - cx);

  // Choose shorter arc direction
  let diff = endAngle - startAngle;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  const anticlockwise = diff < 0;

  const isActive = fromAllocated && toAllocated;
  const isIntermediate = fromAllocated || toAllocated;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, anticlockwise);

  if (isActive) {
    ctx.strokeStyle = '#c8a862';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.95;
  } else if (isIntermediate) {
    ctx.strokeStyle = '#7a6d3a';
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.75;
  } else {
    ctx.strokeStyle = '#555850';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.65;
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Layer: Nodes (icons + frames)
// ---------------------------------------------------------------------------

function drawNodes(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  zoomKey: string,
): void {
  const { nodes, allocatedIds, allocatableIds, sprites, assetUrl, hoveredNodeId, searchMatchIds, pathPreviewIds, prunePreviewIds, hoveredMasteryName } = state;
  const zoomLevel = parseFloat(zoomKey) || 0.3835;
  const invZoom = 1 / zoomLevel;

  const nodeById = new Map<string, ProcessedAtlasNode>();
  for (const n of nodes) nodeById.set(n.id, n);

  for (const node of nodes) {
    const isAllocated = allocatedIds.has(node.skill);
    const isAllocatable = allocatableIds.has(node.id);
    const isHovered = node.id === hoveredNodeId;
    const isSearchMatch = searchMatchIds.has(node.id);
    const isPathPreview = pathPreviewIds.has(node.id);
    const isPrunePreview = prunePreviewIds.has(node.id);

    // Icon — path preview nodes render as if allocated
    const showAsAllocated = isAllocated || isPathPreview;
    const iconCategory = getIconCategory(sprites, node.nodeType, showAsAllocated);
    const iconName = node.nodeType === 'wormhole' ? 'Wormhole' : node.icon;

    drawSprite(ctx, iconCategory, iconName, zoomKey, node.x, node.y, invZoom, assetUrl);

    // Frame
    if (node.nodeType !== 'mastery') {
      const frameName = getFrameName(node.nodeType, showAsAllocated, isAllocatable);
      drawSprite(ctx, sprites.frame, frameName, zoomKey, node.x, node.y, invZoom, assetUrl);
    }

    // Path preview glow (gold)
    if (isPathPreview) {
      drawPreviewRing(ctx, node, '#c8a862', 0.7);
    }

    // Prune preview glow (red)
    if (isPrunePreview) {
      drawPreviewRing(ctx, node, '#e74c3c', 0.5);
    }

    // Highlight effects (search matches blink)
    if (isHovered || isSearchMatch) {
      drawHighlight(ctx, node, isSearchMatch, state.animTime);
    }

    // Allocatable glow
    if (isAllocatable && !isAllocated && !isPathPreview && node.nodeType !== 'mastery') {
      drawAllocatableGlow(ctx, node);
    }

    // Mastery group highlight — when hovering a mastery, highlight all siblings (blink)
    if (node.isMastery && hoveredMasteryName && node.name === hoveredMasteryName) {
      drawMasteryHighlight(ctx, node, state.animTime);
    }
  }

  // Draw mastery name label at hovered mastery position
  if (hoveredMasteryName && hoveredNodeId) {
    const hoveredNode = nodeById.get(hoveredNodeId);
    if (hoveredNode?.isMastery) {
      drawMasteryLabel(ctx, hoveredNode, hoveredMasteryName, invZoom);
    }
  }
}

function drawMasteryHighlight(
  ctx: CanvasRenderingContext2D,
  node: ProcessedAtlasNode,
  animTime: number,
): void {
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(animTime * 0.003));
  const r = getNodeWorldRadius(node.nodeType) * (1.15 + 0.1 * Math.sin(animTime * 0.003));
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#b388ff';
  ctx.lineWidth = 4;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = '#b388ff';
  ctx.shadowBlur = 16 + 8 * Math.sin(animTime * 0.003);
  ctx.stroke();
  ctx.restore();
}

function drawMasteryLabel(
  ctx: CanvasRenderingContext2D,
  node: ProcessedAtlasNode,
  name: string,
  invZoom: number,
): void {
  const fontSize = Math.round(14 * invZoom);
  ctx.save();
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const y = node.y - getNodeWorldRadius(node.nodeType) - 10 * invZoom;

  // Background
  const metrics = ctx.measureText(name);
  const padX = 8 * invZoom;
  const padY = 4 * invZoom;
  ctx.fillStyle = '#1a1a2e';
  ctx.globalAlpha = 0.85;
  ctx.fillRect(
    node.x - metrics.width / 2 - padX,
    y - fontSize - padY,
    metrics.width + padX * 2,
    fontSize + padY * 2,
  );

  // Text
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#b388ff';
  ctx.fillText(name, node.x, y);
  ctx.restore();
}

function drawHighlight(
  ctx: CanvasRenderingContext2D,
  node: ProcessedAtlasNode,
  isSearch: boolean,
  animTime: number,
): void {
  const pulse = isSearch ? 0.4 + 0.6 * Math.abs(Math.sin(animTime * 0.004)) : 0.5;
  const r = getNodeWorldRadius(node.nodeType) * (isSearch ? 1.2 + 0.15 * Math.sin(animTime * 0.004) : 1.3);
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = isSearch ? '#FFD700' : '#FFFFFF';
  ctx.lineWidth = isSearch ? 4 : 3;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = isSearch ? '#FFD700' : '#FFFFFF';
  ctx.shadowBlur = isSearch ? 12 + 10 * Math.sin(animTime * 0.004) : 15;
  ctx.stroke();
  ctx.restore();
}

function drawAllocatableGlow(
  ctx: CanvasRenderingContext2D,
  node: ProcessedAtlasNode,
): void {
  const r = getNodeWorldRadius(node.nodeType) * 1.1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#7a6d3a';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.shadowColor = '#AF6025';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawPreviewRing(
  ctx: CanvasRenderingContext2D,
  node: ProcessedAtlasNode,
  color: string,
  alpha: number,
): void {
  const r = getNodeWorldRadius(node.nodeType) * 1.4;
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Off-screen arrows — point toward highlighted nodes outside viewport
// ---------------------------------------------------------------------------

const ARROW_MARGIN = 40;
/**
 * Top-left screen area covered by the zoom controls and the Jump to select (w-40 at left-3, so x 12-172), plus a 12px
 * arrow margin; arrows stay out of it. Kept even on trees without the select, where it only nudges a few arrows.
 */
export const CONTROLS_KEEP_OUT = { width: 184, height: 192 };

/**
 * Where to draw the arrow pointing at screen point (sx, sy), or null when the point is on screen.
 * The arrow sits on an ellipse inside the viewport edge, in the direction of the point from the centre.
 */
export function offScreenArrowPoint(
  sx: number,
  sy: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; angle: number } | null {
  const m = ARROW_MARGIN;
  if (sx >= m && sx <= viewportWidth - m && sy >= m && sy <= viewportHeight - m) return null;

  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  let x = Math.max(m, Math.min(viewportWidth - m, cx + Math.cos(angle) * (viewportWidth / 2 - m)));
  let y = Math.max(m, Math.min(viewportHeight - m, cy + Math.sin(angle) * (viewportHeight / 2 - m)));

  // In the controls corner: a target further out to the left moves the arrow down, one further up moves it right
  if (x < CONTROLS_KEEP_OUT.width && y < CONTROLS_KEEP_OUT.height) {
    if (-sx > -sy) y = CONTROLS_KEEP_OUT.height;
    else x = CONTROLS_KEEP_OUT.width;
  }
  return { x, y, angle };
}

function drawOffScreenArrows(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
): void {
  const { nodes, searchMatchIds, hoveredMasteryName, animTime, zoom, panX, panY, viewportWidth, viewportHeight } = state;
  if (searchMatchIds.size === 0 && !hoveredMasteryName) return;

  const arrowSize = 12;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(animTime * 0.004));

  // Collect off-screen highlighted nodes
  const targets: Array<{ x: number; y: number; angle: number; color: string }> = [];

  for (const node of nodes) {
    const isSearch = searchMatchIds.has(node.id);
    const isMastery = node.isMastery && hoveredMasteryName && node.name === hoveredMasteryName;
    if (!isSearch && !isMastery) continue;

    // World to screen
    const sx = node.x * zoom + panX;
    const sy = node.y * zoom + panY;

    const point = offScreenArrowPoint(sx, sy, viewportWidth, viewportHeight);
    if (point) targets.push({ ...point, color: isSearch ? '#FFD700' : '#b388ff' });
  }

  if (targets.length === 0) return;

  ctx.save();
  for (const { x: edgeX, y: edgeY, angle, color } of targets) {
    // Draw arrow
    ctx.beginPath();
    ctx.moveTo(
      edgeX + Math.cos(angle) * arrowSize,
      edgeY + Math.sin(angle) * arrowSize,
    );
    ctx.lineTo(
      edgeX + Math.cos(angle + 2.5) * arrowSize,
      edgeY + Math.sin(angle + 2.5) * arrowSize,
    );
    ctx.lineTo(
      edgeX + Math.cos(angle - 2.5) * arrowSize,
      edgeY + Math.sin(angle - 2.5) * arrowSize,
    );
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Hit testing — find which node is under a screen coordinate
// ---------------------------------------------------------------------------

export function hitTestNode(
  screenX: number,
  screenY: number,
  state: RenderState,
): ProcessedAtlasNode | undefined {
  // Convert screen coords to world coords
  const worldX = (screenX - state.panX) / state.zoom;
  const worldY = (screenY - state.panY) / state.zoom;

  let closest: ProcessedAtlasNode | undefined;
  let closestDist = Infinity;

  for (const node of state.nodes) {
    const r = getNodeWorldRadius(node.nodeType);
    const dx = node.x - worldX;
    const dy = node.y - worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= r * 1.3 && dist < closestDist) {
      closestDist = dist;
      closest = node;
    }
  }

  return closest;
}

/**
 * Convert screen coords to world coords.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  state: Pick<RenderState, 'panX' | 'panY' | 'zoom'>,
): { x: number; y: number } {
  return {
    x: (screenX - state.panX) / state.zoom,
    y: (screenY - state.panY) / state.zoom,
  };
}
