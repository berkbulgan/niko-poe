// ABOUTME: Canvas-based atlas skill tree renderer with zoom, pan, node interaction, zoom controls and focus-on-node.
// ABOUTME: Uses GGG sprite sheets for authentic rendering with hit-test based tooltips; readOnly turns off allocation.

import { useState, useCallback, useRef, useMemo, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/select';
import { IconTooltip } from '@/components/ui/tooltip';
import { NodeChoices, VariantPicker } from '@/components/atlas-tree/node-choices';
import type {
  ProcessedAtlasNode,
  AtlasNodeData,
  AtlasSprites,
  AtlasConnection,
} from '@/types/atlas-tree';
import { getAllocatableNeighbors, getStartingNodeIds, getStartPosition, getHubNodeIds, buildConnections, findShortestPath, pruneDisconnected, searchMatches, boundsOf, clampPan, jumpBox } from '@/lib/atlas-tree-utils';
import { renderAtlasTree, hitTestNode, type RenderState } from '@/lib/atlas-canvas-renderer';
import { initZoomLevels, preloadSprites, pickZoomLevel, type AssetUrl } from '@/lib/atlas-sprite-loader';

interface TreeRendererProps {
  nodes: ProcessedAtlasNode[];
  rawNodes: Record<string, AtlasNodeData>;
  allocatedIds: Set<number>;
  /** choices: variants picked for the multiple-choice notables an allocation adds (asked in a popup first). */
  onToggleNode?: (nodeId: number, choices?: Record<string, number>) => void;
  /** Allocate a list of node skills at once (for shortest-path selection). */
  onAllocatePath?: (nodeIds: number[], choices?: Record<string, number>) => void;
  /** Chosen variant of each allocated multiple-choice notable, shown in tooltips. */
  variantChoices?: Record<string, number>;
  searchHighlight?: string;
  sprites: AtlasSprites;
  imageZoomLevels: number[];
  /** Sprite sheet file name → URL for this tree's atlas tag. */
  assetUrl: AssetUrl;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  groups: Record<string, { x: number; y: number; background?: { image: string; offsetX?: number; offsetY?: number } }>;
  /** A new object centers the view on that node (zoom at least FOCUS_ZOOM) and gives it the hover highlight. */
  focus?: { nodeId: string } | null;
  /** Options of the "Jump to…" select; choosing one fits the view to those nodes, or to the nearest of their groups when they do not all fit. */
  jumpTargets?: Array<{ label: string; nodeIds: string[] }>;
  /** View only: no click allocation, no hover previews or point cost (zooming still works). */
  readOnly?: boolean;
  /** What the first render fits: the whole tree (default), or the allocated nodes when there are any. */
  initialFit?: 'tree' | 'allocated';
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

interface TooltipState {
  node: ProcessedAtlasNode;
  screenX: number;
  screenY: number;
}

/** An allocation waiting for its multiple-choice notables' variants, asked one node at a time. */
interface PickState {
  /** The allocation the skills were computed from; any change to it (undo, another tree) drops the pick. */
  base: Set<number>;
  skills: number[];
  path: boolean;
  queue: AtlasNodeData[];
  picked: Record<string, number>;
  x: number;
  y: number;
  maxHeight: number;
}

interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

const MAX_ZOOM = 0.5;
const ZOOM_SPEED = 0.002;
/** Zoom factor of one +/- button press or key. */
const ZOOM_STEP = 1.15;
/** Minimum zoom when centering on a focused node. */
const FOCUS_ZOOM = 0.3;
/** Height fraction a focused node is centred at: above the middle, clear of the search results list. */
const FOCUS_Y = 0.35;

export function TreeRenderer({
  nodes,
  rawNodes,
  allocatedIds,
  onToggleNode,
  onAllocatePath,
  variantChoices,
  searchHighlight,
  sprites,
  imageZoomLevels,
  assetUrl,
  bounds,
  groups,
  focus,
  jumpTargets,
  readOnly = false,
  initialFit = 'tree',
}: TreeRendererProps) {
  // Lowest zoom = smallest sprite sheet scale, so Fit can show as much of the tree as the sprites allow
  const minZoom = Math.min(...imageZoomLevels);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(minZoom);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [spritesReady, setSpritesReady] = useState(false);
  const [spritesFailed, setSpritesFailed] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [picking, setPicking] = useState<PickState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  /** Bumped when the canvas needs a new frame without a render state change (resize, sprites loaded). */
  const [redrawTick, setRedrawTick] = useState(0);
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
  const zoomRef = useRef(minZoom);
  const panRef = useRef({ x: 0, y: 0 });

  // Initialize sprite system and preload
  useEffect(() => {
    initZoomLevels(imageZoomLevels, sprites);
    const zoomKey = pickZoomLevel(minZoom);
    preloadSprites(sprites, zoomKey, assetUrl).then(
      () => setSpritesReady(true),
      (err: unknown) => {
        console.error('[TreeRenderer] sprite preload failed:', err);
        setSpritesFailed(true);
      },
    );
  }, [sprites, imageZoomLevels, assetUrl, minZoom]);

  // Preload the zoom level's sprites when zoom changes, then redraw with them
  useEffect(() => {
    if (!spritesReady) return;
    const zoomKey = pickZoomLevel(zoom);
    preloadSprites(sprites, zoomKey, assetUrl).then(() => setRedrawTick((t) => t + 1));
  }, [zoom, sprites, spritesReady, assetUrl]);

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

  const searchMatchIds = useMemo(
    () => new Set(searchMatches(nodes, searchHighlight ?? '').map((n) => n.id)),
    [nodes, searchHighlight],
  );

  const allocatedBox = useMemo(
    () => boundsOf(nodes.filter((n) => allocatedIds.has(n.skill))),
    [nodes, allocatedIds],
  );

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

  const startPosition = useMemo(() => getStartPosition(rawNodes, groups), [rawNodes, groups]);

  const hubNodeIds = useMemo(
    () => getHubNodeIds(rawNodes),
    [rawNodes],
  );

  // Compute hover preview: path that would be allocated or nodes that would be pruned
  const { pathPreviewIds, prunePreviewIds } = useMemo(() => {
    const emptySet = new Set<string>();
    if (readOnly || !hoveredNodeId) return { pathPreviewIds: emptySet, prunePreviewIds: emptySet };

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
  }, [readOnly, hoveredNodeId, allocatedIds, allocatedStringIds, allocatableNeighbors, rawNodes, hubNodeIds, nodeMap]);

  const renderState = useMemo((): RenderState => ({
    nodes,
    connections,
    allocatedIds,
    allocatableIds: allocatableNeighbors,
    sprites,
    assetUrl,
    bounds,
    groups,
    zoom,
    panX,
    panY,
    hoveredNodeId: hoveredNodeId ?? focusedId,
    searchMatchIds,
    startingNodeIds,
    startPosition,
    pathPreviewIds,
    prunePreviewIds,
    hoveredMasteryName,
    masteryGroupMap,
    animTime: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  }), [nodes, connections, allocatedIds, allocatableNeighbors, sprites, assetUrl, bounds, groups, zoom, panX, panY, hoveredNodeId, focusedId, searchMatchIds, startingNodeIds, startPosition, pathPreviewIds, prunePreviewIds, hoveredMasteryName, masteryGroupMap]);

  /** Sets zoom and pan (clamped) in both the refs and the state. */
  const applyView = useCallback((z: number, px: number, py: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clamped = clampPan(px, py, z, rect.width, rect.height, bounds);
    zoomRef.current = z;
    panRef.current = clamped;
    setZoom(z);
    setPanX(clamped.x);
    setPanY(clamped.y);
    // The view moved under the cursor, so the old hover no longer matches what is under it
    setTooltip(null);
    setHoveredNodeId(null);
  }, [bounds]);

  /** Puts world point (wx, wy) at the horizontal middle and fy of the height of the viewport at zoom z. */
  const centerOn = useCallback((z: number, wx: number, wy: number, fy = 0.5) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    applyView(z, rect.width / 2 - wx * z, rect.height * fy - wy * z);
  }, [applyView]);

  /** Fits a world-space box with a 10% margin on each side, zooming in no further than maxZoom. */
  const fitBox = useCallback((box: Box, maxZoom = MAX_ZOOM) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const fit = Math.min(rect.width / (box.maxX - box.minX), rect.height / (box.maxY - box.minY)) / 1.2;
    const z = Math.max(minZoom, Math.min(maxZoom, fit));
    centerOn(z, (box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
  }, [centerOn, minZoom]);

  /** Zooms by a factor around the viewport center. */
  const zoomBy = useCallback((factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const oldZoom = zoomRef.current;
    const newZoom = Math.min(MAX_ZOOM, Math.max(minZoom, oldZoom * factor));
    centerOn(
      newZoom,
      (rect.width / 2 - panRef.current.x) / oldZoom,
      (rect.height / 2 - panRef.current.y) / oldZoom,
    );
  }, [centerOn, minZoom]);

  // Fit the tree (or the allocated nodes) once the sprites are ready
  useEffect(() => {
    if (initialized || !containerRef.current || !spritesReady) return;
    fitBox((initialFit === 'allocated' && allocatedBox) || bounds);
    setInitialized(true);
  }, [initialized, spritesReady, fitBox, initialFit, allocatedBox, bounds]);

  // Center on the focused node whenever a new focus object arrives
  useEffect(() => {
    if (!focus) { setFocusedId(null); return; }
    const node = nodeMap.get(focus.nodeId);
    if (!node) return;
    setFocusedId(node.id);
    centerOn(Math.max(zoomRef.current, FOCUS_ZOOM), node.x, node.y, FOCUS_Y);
  }, [focus, nodeMap, centerOn]);

  // Keyboard zoom: + / = in, - out, 0 fits the tree (not while typing or with modifiers)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
      else if (e.key === '-') zoomBy(1 / ZOOM_STEP);
      else if (e.key === '0') fitBox(bounds);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomBy, fitBox, bounds]);

  // Resize canvas to match container. Assigning width/height clears the bitmap, so only do it on a
  // real size change, and then ask for a new frame.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(width * dpr);
        const h = Math.round(height * dpr);
        if (canvas.width === w && canvas.height === h) continue;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        setRedrawTick((t) => t + 1);
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
  }, [renderState, spritesReady, needsAnimation, redrawTick]);

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
      const newZoom = Math.min(MAX_ZOOM, Math.max(minZoom, oldZoom + delta * oldZoom));

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
      // The node under the cursor changes with the zoom; the next mouse move hit-tests again.
      setTooltip(null);
      setHoveredNodeId(null);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [bounds, minZoom]);

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

    if (readOnly || !wasPanning || didDragRef.current) return;

    // Click — check if a node was hit
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hit = hitTestNode(mouseX, mouseY, renderState);

    if (hit && hit.nodeType !== 'mastery') {
      // Allocations that add multiple-choice notables wait for their variants; the popup sits by the cursor, inside the tree.
      const allocate = (skills: number[], path: boolean) => {
        const queue = skills.map((s) => rawNodes[String(s)]).filter((n) => n?.variantEffects?.length);
        if (queue.length === 0) {
          if (path) onAllocatePath?.(skills);
          else onToggleNode?.(skills[0]);
          return;
        }
        setTooltip(null);
        const y = Math.max(rect.top, Math.min(e.clientY + 12, rect.bottom - 260));
        setPicking({
          base: allocatedIds, skills, path, queue, picked: {},
          x: Math.max(rect.left, Math.min(e.clientX + 12, rect.right - 330)),
          y,
          maxHeight: rect.bottom - y - 8,
        });
      };
      const isAllocated = allocatedIds.has(hit.skill);
      const isAllocatable = allocatableNeighbors.has(hit.id);
      if (isAllocated) {
        onToggleNode?.(hit.skill);
      } else if (isAllocatable) {
        allocate([hit.skill], false);
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
            allocate(pathSkills, true);
          }
        }
      }
    }
  }, [readOnly, renderState, allocatedIds, allocatedStringIds, allocatableNeighbors, hubNodeIds, onToggleNode, onAllocatePath, rawNodes]);

  const activePick = picking?.base === allocatedIds ? picking : null;
  const handlePick = useCallback((effect: number) => {
    if (!picking || picking.base !== allocatedIds) return;
    const [node, ...rest] = picking.queue;
    const picked = { ...picking.picked, [String(node.skill)]: effect };
    if (rest.length > 0) {
      setPicking({ ...picking, queue: rest, picked });
      return;
    }
    setPicking(null);
    if (picking.path) onAllocatePath?.(picking.skills, picked);
    else onToggleNode?.(picking.skills[0], picked);
  }, [picking, allocatedIds, onAllocatePath, onToggleNode]);
  const cancelPick = useCallback(() => setPicking(null), []);

  const handleMouseLeave = useCallback(() => {
    panStateRef.current.isPanning = false;
    setTooltip(null);
    setHoveredNodeId(null);
  }, []);

  // Point cost of clicking the hovered node (previews are empty in readOnly, so no line there).
  let costLine: string | null = null;
  if (tooltip) {
    const allocated = allocatedIds.has(tooltip.node.skill);
    const n = allocated ? prunePreviewIds.size : pathPreviewIds.size;
    if (n > 0) costLine = allocated ? `Removes ${n} node${n === 1 ? '' : 's'}` : `+${n} point${n === 1 ? '' : 's'}`;
  }

  const controls = [
    { label: 'Zoom in (+)', icon: Plus, onClick: () => zoomBy(ZOOM_STEP), disabled: false },
    { label: 'Zoom out (−)', icon: Minus, onClick: () => zoomBy(1 / ZOOM_STEP), disabled: false },
    { label: 'Zoom out fully (0)', icon: Maximize, onClick: () => fitBox(bounds), disabled: false },
    { label: 'Fit allocated', icon: Crosshair, onClick: () => { if (allocatedBox) fitBox(allocatedBox); }, disabled: !allocatedBox },
  ];

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
      {tooltip && createPortal(
        <div
          className="pointer-events-none fixed z-[60] max-w-xs rounded border border-poe-border bg-poe-panel px-3 py-2 shadow-lg"
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
          {costLine && <p className="text-xs text-poe-text-muted">{costLine}</p>}
          {tooltip.node.stats.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {tooltip.node.stats.map((stat, i) => (
                <li key={i} className="text-xs text-poe-text-dim">{stat}</li>
              ))}
            </ul>
          )}
          <NodeChoices node={tooltip.node} chosen={variantChoices?.[tooltip.node.id]} />
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
        </div>,
        document.body,
      )}

      {activePick && (
        <VariantPicker
          key={activePick.queue[0].skill}
          node={activePick.queue[0]}
          x={activePick.x}
          y={activePick.y}
          maxHeight={activePick.maxHeight}
          onPick={handlePick}
          onCancel={cancelPick}
        />
      )}

      {/* Zoom controls and Jump to (stop mouse events so clicks here don't pan or allocate) */}
      {spritesReady && (
        <div
          className="absolute left-3 top-3 flex flex-col items-start gap-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col overflow-hidden rounded-md border border-poe-border/40 bg-poe-panel/90 shadow-lg">
            {controls.map(({ label, icon: Icon, onClick, disabled }) => (
              <IconTooltip key={label} label={label}>
                <Button variant="ghost" size="sm" className="size-8 rounded-none p-0" aria-label={label} onClick={onClick} disabled={disabled}>
                  <Icon className="size-4" />
                </Button>
              </IconTooltip>
            ))}
          </div>
          {jumpTargets && jumpTargets.length > 0 && (
            <SimpleSelect
              size="sm"
              value=""
              onValueChange={(label) => {
                const target = jumpTargets.find((t) => t.label === label);
                const container = containerRef.current;
                if (!target || !container) return;
                const rect = container.getBoundingClientRect();
                const z = zoomRef.current;
                // From the view centre; the limit is what minZoom shows (fitBox drops its margin there)
                const box = jumpBox(
                  target.nodeIds.flatMap((id) => nodeMap.get(id) ?? []),
                  { x: (rect.width / 2 - panRef.current.x) / z, y: (rect.height / 2 - panRef.current.y) / z },
                  rect.width / minZoom,
                  rect.height / minZoom,
                );
                // A small mechanic core (one group in 3.30) would otherwise fill the view at full zoom.
                if (box) fitBox(box, FOCUS_ZOOM);
              }}
              options={jumpTargets.map((t) => ({ value: t.label, label: t.label }))}
              placeholder="Jump to…"
              aria-label="Jump to mechanic"
              className="w-40 bg-poe-panel/90"
            />
          )}
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 rounded bg-poe-panel/80 px-2 py-1 text-xs text-poe-text-muted">
        {Math.round(((zoom - minZoom) / (MAX_ZOOM - minZoom)) * 100)}%
      </div>
    </div>
  );
}
