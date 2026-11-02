// ABOUTME: Canvas-based atlas skill tree renderer with zoom, pan, and node interaction.
// ABOUTME: Uses GGG sprite sheets for authentic rendering with hit-test based tooltips.

import { useState, useCallback, useRef, useMemo, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '@/lib/utils';
import type {
  ProcessedAtlasNode,
  AtlasNodeData,
  AtlasSprites,
  AtlasConnection,
} from '@/types/atlas-tree';
import { getAllocatableNeighbors, getStartingNodeIds, getHubNodeIds, buildConnections, findShortestPath, pruneDisconnected } from '@/lib/atlas-tree-utils';
import { renderAtlasTree, hitTestNode, type RenderState } from '@/lib/atlas-canvas-renderer';
import { initZoomLevels, preloadSprites, pickZoomLevel } from '@/lib/atlas-sprite-loader';

interface TreeRendererProps {
  nodes: ProcessedAtlasNode[];
  rawNodes: Record<string, AtlasNodeData>;
  allocatedIds: Set<number>;
  onToggleNode: (nodeId: number) => void;
  /** Allocate a list of node skills at once (for shortest-path selection). */
  onAllocatePath: (nodeIds: number[]) => void;
  searchHighlight?: string;
  sprites: AtlasSprites;
  imageZoomLevels: number[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  groups: Record<string, { x: number; y: number; background?: { image: string; offsetX?: number; offsetY?: number } }>;
}

interface TooltipState {
  node: ProcessedAtlasNode;
  screenX: number;
  screenY: number;
}

interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 0.5;
const ZOOM_SPEED = 0.002;

/**
 * Clamps pan so the tree background never leaves the viewport.
 * The tree world-space rect (bounds) scaled by zoom must cover the container.
 */
function clampPan(
  px: number,
  py: number,
  currentZoom: number,
  containerW: number,
  containerH: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): { x: number; y: number } {
  // Scaled tree edges in screen space = pan + worldCoord * zoom
  // We want: pan + bounds.minX * zoom >= 0  (left edge stays in view)
  //          pan + bounds.maxX * zoom <= containerW (right edge stays in view)
  // => pan in [containerW - maxX*zoom, -minX*zoom]
  // 10% margin so nodes near the edge aren't clipped
  const treeW = (bounds.maxX - bounds.minX) * currentZoom;
  const treeH = (bounds.maxY - bounds.minY) * currentZoom;
  const marginX = treeW * 0.1;
  const marginY = treeH * 0.1;

  const minPanX = containerW - bounds.maxX * currentZoom - marginX;
  const maxPanX = -bounds.minX * currentZoom + marginX;
  const minPanY = containerH - bounds.maxY * currentZoom - marginY;
  const maxPanY = -bounds.minY * currentZoom + marginY;

  return {
    x: Math.min(maxPanX, Math.max(minPanX, px)),
    y: Math.min(maxPanY, Math.max(minPanY, py)),
  };
}

function matchesSearch(node: ProcessedAtlasNode, query: string): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  if (node.name.toLowerCase().includes(lower)) return true;
  return node.stats.some((s) => s.toLowerCase().includes(lower));
}

export function TreeRenderer({
  nodes,
  rawNodes,
  allocatedIds,
  onToggleNode,
  onAllocatePath,
  searchHighlight,
  sprites,
  imageZoomLevels,
  bounds,
  groups,
}: TreeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [spritesReady, setSpritesReady] = useState(false);
  const [spritesFailed, setSpritesFailed] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const animTimeRef = useRef(0);
  const rafIdRef = useRef(0);

  const panStateRef = useRef<PanState>({
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const didDragRef = useRef(false);
  const zoomRef = useRef(MIN_ZOOM);
  const panRef = useRef({ x: 0, y: 0 });
  // Tree dimensions from data
  const treeWidth = bounds.maxX - bounds.minX;
  const treeHeight = bounds.maxY - bounds.minY;
  const treeCenterX = (bounds.minX + bounds.maxX) / 2;
  const treeCenterY = (bounds.minY + bounds.maxY) / 2;

  // Initialize sprite system and preload
  useEffect(() => {
    initZoomLevels(imageZoomLevels, sprites);
    const zoomKey = pickZoomLevel(MIN_ZOOM);
    preloadSprites(sprites, zoomKey).then(
      () => setSpritesReady(true),
      (err: unknown) => {
        console.error('[TreeRenderer] sprite preload failed:', err);
        setSpritesFailed(true);
      },
    );
  }, [sprites, imageZoomLevels]);

  // Preload next zoom level when zoom changes
  useEffect(() => {
    if (!spritesReady) return;
    const zoomKey = pickZoomLevel(zoom);
    preloadSprites(sprites, zoomKey);
  }, [zoom, sprites, spritesReady]);

  const allocatedStringIds = useMemo(
    () => new Set(Array.from(allocatedIds).map(String)),
    [allocatedIds],
  );

  const allocatableNeighbors = useMemo(
    () => getAllocatableNeighbors(rawNodes, allocatedStringIds),
    [rawNodes, allocatedStringIds],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, ProcessedAtlasNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const connections: AtlasConnection[] = useMemo(
    () => buildConnections(nodes, nodeMap),
    [nodes, nodeMap],
  );

  const searchMatchIds = useMemo(() => {
    const ids = new Set<string>();
    if (!searchHighlight) return ids;
    for (const node of nodes) {
      if (matchesSearch(node, searchHighlight)) ids.add(node.id);
    }
    return ids;
  }, [nodes, searchHighlight]);

  // Mastery group mapping — same name across different groups
  const masteryGroupMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.isMastery || !node.name) continue;
      const list = map.get(node.name);
      if (list) list.push(node.id);
      else map.set(node.name, [node.id]);
    }
    return map;
  }, [nodes]);

  const hoveredMasteryName = useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = nodeMap.get(hoveredNodeId);
    if (!node?.isMastery) return null;
    return node.name || null;
  }, [hoveredNodeId, nodeMap]);

  // Build render state for the canvas renderer
  const startingNodeIds = useMemo(
    () => getStartingNodeIds(rawNodes),
    [rawNodes],
  );

  const hubNodeIds = useMemo(
    () => getHubNodeIds(rawNodes),
    [rawNodes],
  );

  // Compute hover preview: path that would be allocated or nodes that would be pruned
  const { pathPreviewIds, prunePreviewIds } = useMemo(() => {
    const emptySet = new Set<string>();
    if (!hoveredNodeId) return { pathPreviewIds: emptySet, prunePreviewIds: emptySet };

    const hoveredNode = nodeMap.get(hoveredNodeId);
    if (!hoveredNode || hoveredNode.nodeType === 'mastery') return { pathPreviewIds: emptySet, prunePreviewIds: emptySet };

    const isAllocated = allocatedIds.has(hoveredNode.skill);
    const isAllocatable = allocatableNeighbors.has(hoveredNodeId);

    if (isAllocated) {
      // Preview: which nodes would be pruned if this is removed
      const reachable = pruneDisconnected(hoveredNodeId, allocatedStringIds, rawNodes);
      const wouldPrune = new Set<string>();
      for (const id of allocatedStringIds) {
        if (id !== hoveredNodeId && !reachable.has(id)) wouldPrune.add(id);
      }
      wouldPrune.add(hoveredNodeId);
      return { pathPreviewIds: emptySet, prunePreviewIds: wouldPrune };
    }

    if (isAllocatable) {
      // Single node allocation — just highlight that node
      return { pathPreviewIds: new Set([hoveredNodeId]), prunePreviewIds: emptySet };
    }

    // Preview: shortest path that would be allocated
    const fromSet = new Set(allocatedStringIds);
    for (const h of hubNodeIds) fromSet.add(h);
    const path = findShortestPath(rawNodes, fromSet, hoveredNodeId);
    return { pathPreviewIds: new Set(path), prunePreviewIds: emptySet };
  }, [hoveredNodeId, allocatedIds, allocatedStringIds, allocatableNeighbors, rawNodes, hubNodeIds, nodeMap]);

  const renderState = useMemo((): RenderState => ({
    nodes,
    connections,
    allocatedIds,
    allocatableIds: allocatableNeighbors,
    sprites,
    bounds,
    groups,
    zoom,
    panX,
    panY,
    hoveredNodeId,
    searchMatchIds,
    startingNodeIds,
    pathPreviewIds,
    prunePreviewIds,
    hoveredMasteryName,
    masteryGroupMap,
    animTime: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  }), [nodes, connections, allocatedIds, allocatableNeighbors, sprites, bounds, groups, zoom, panX, panY, hoveredNodeId, searchMatchIds, startingNodeIds, pathPreviewIds, prunePreviewIds, hoveredMasteryName, masteryGroupMap]);

  // Auto-fit tree to container on mount
  useEffect(() => {
    if (initialized || !containerRef.current || !spritesReady) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / treeWidth;
    const scaleY = rect.height / treeHeight;
    const fitZoom = Math.min(scaleX, scaleY) * 0.85;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

    const centerX = rect.width / 2 - treeCenterX * clampedZoom;
    const centerY = rect.height / 2 - treeCenterY * clampedZoom;
    const initPan = clampPan(centerX, centerY, clampedZoom, rect.width, rect.height, bounds);

    zoomRef.current = clampedZoom;
    panRef.current = initPan;
    setZoom(clampedZoom);
    setPanX(initPan.x);
    setPanY(initPan.y);
    setInitialized(true);
  }, [initialized, spritesReady, treeWidth, treeHeight, treeCenterX, treeCenterY]);

  // Resize canvas to match container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Determine if animation is needed (search or mastery highlight active)
  const needsAnimation = searchMatchIds.size > 0 || hoveredMasteryName !== null;
  const renderStateRef = useRef(renderState);
  renderStateRef.current = renderState;

  // Main render loop — runs rAF when animating, single frame otherwise
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !spritesReady) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function frame(timestamp: number) {
      animTimeRef.current = timestamp;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rect = container!.getBoundingClientRect();
      renderAtlasTree(ctx!, canvas!, {
        ...renderStateRef.current,
        animTime: timestamp,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
      });
      if (needsAnimation) {
        rafIdRef.current = requestAnimationFrame(frame);
      }
    }

    rafIdRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [renderState, spritesReady, needsAnimation]);

  // Wheel zoom with zoom-toward-cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(e: globalThis.WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      const delta = -e.deltaY * ZOOM_SPEED;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom + delta * oldZoom));

      // Zoom toward cursor
      const worldX = (mouseX - panRef.current.x) / oldZoom;
      const worldY = (mouseY - panRef.current.y) / oldZoom;
      const rawPanX = mouseX - worldX * newZoom;
      const rawPanY = mouseY - worldY * newZoom;

      const clamped = clampPan(rawPanX, rawPanY, newZoom, rect.width, rect.height, bounds);
      zoomRef.current = newZoom;
      panRef.current = clamped;
      setZoom(newZoom);
      setPanX(clamped.x);
      setPanY(clamped.y);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    panStateRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (panStateRef.current.isPanning) {
      const dx = e.clientX - panStateRef.current.startX;
      const dy = e.clientY - panStateRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true;
      }
      const rawPanX = panStateRef.current.startPanX + dx;
      const rawPanY = panStateRef.current.startPanY + dy;
      const clamped = clampPan(rawPanX, rawPanY, zoomRef.current, rect.width, rect.height, bounds);
      panRef.current = clamped;
      setPanX(clamped.x);
      setPanY(clamped.y);
      setTooltip(null);
      return;
    }

    // Hover hit test
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hit = hitTestNode(mouseX, mouseY, renderState);

    if (hit) {
      setHoveredNodeId(hit.id);
      setTooltip({ node: hit, screenX: e.clientX, screenY: e.clientY });
    } else {
      setHoveredNodeId(null);
      setTooltip(null);
    }
  }, [renderState]);

  const handleMouseUp = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const wasPanning = panStateRef.current.isPanning;
    panStateRef.current.isPanning = false;

    if (!wasPanning || didDragRef.current) return;

    // Click — check if a node was hit
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hit = hitTestNode(mouseX, mouseY, renderState);

    if (hit && hit.nodeType !== 'mastery') {
      const isAllocated = allocatedIds.has(hit.skill);
      const isAllocatable = allocatableNeighbors.has(hit.id);
      if (isAllocated) {
        onToggleNode(hit.skill);
      } else if (isAllocatable) {
        onToggleNode(hit.skill);
      } else {
        // Find shortest path — use hubs as root when nothing is allocated
        const fromSet = new Set(allocatedStringIds);
        for (const h of hubNodeIds) fromSet.add(h);
        const path = findShortestPath(rawNodes, fromSet, hit.id);
        if (path.length > 0) {
          const pathSkills = path
            .map((id) => rawNodes[id]?.skill)
            .filter((s): s is number => s != null);
          if (pathSkills.length > 0) {
            onAllocatePath(pathSkills);
          }
        }
      }
    }
  }, [renderState, allocatedIds, allocatedStringIds, allocatableNeighbors, hubNodeIds, onToggleNode, onAllocatePath, rawNodes]);

  const handleMouseLeave = useCallback(() => {
    panStateRef.current.isPanning = false;
    setTooltip(null);
    setHoveredNodeId(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#060911]"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: panStateRef.current.isPanning ? 'grabbing' : hoveredNodeId ? 'pointer' : 'grab', userSelect: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ userSelect: 'none' }}
      />

      {/* Loading overlay */}
      {!spritesReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060911]">
          <p className="text-sm text-poe-text-muted">
            {spritesFailed ? 'Failed to load atlas tree images — try restarting the app' : 'Loading atlas tree...'}
          </p>
        </div>
      )}

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded border border-poe-border bg-poe-panel px-3 py-2 shadow-lg"
          style={{
            left: tooltip.screenX + 12,
            top: tooltip.screenY + 12,
          }}
        >
          <p className={cn(
            'text-sm font-semibold',
            tooltip.node.isKeystone ? 'text-poe-currency' :
            tooltip.node.isNotable ? 'text-poe-gold' :
            tooltip.node.isWormhole ? 'text-poe-unique' :
            'text-poe-text',
          )}>
            {tooltip.node.name}
          </p>
          {tooltip.node.stats.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {tooltip.node.stats.map((stat, i) => (
                <li key={i} className="text-xs text-poe-text-dim">{stat}</li>
              ))}
            </ul>
          )}
          {tooltip.node.reminderText && tooltip.node.reminderText.length > 0 && (
            <p className="mt-1 text-xs italic text-poe-text-muted">
              {tooltip.node.reminderText.join(' ')}
            </p>
          )}
          {tooltip.node.flavourText && tooltip.node.flavourText.length > 0 && (
            <p className="mt-1.5 border-t border-poe-border/30 pt-1.5 text-xs italic text-poe-unique">
              {tooltip.node.flavourText.join(' ')}
            </p>
          )}
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 rounded bg-poe-panel/80 px-2 py-1 text-xs text-poe-text-muted">
        {Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100)}%
      </div>
    </div>
  );
}
