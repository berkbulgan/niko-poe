// ABOUTME: SVG-based atlas skill tree renderer with zoom, pan, and node interaction.
// ABOUTME: Renders processed atlas nodes with allocation toggling, tooltips, and search highlighting.



import { useState, useCallback, useRef, useMemo, useEffect, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import type { ProcessedAtlasNode, AtlasNodeData } from '@/types/atlas-tree';
import { getAllocatableNeighbors, canDeallocate } from '@/lib/atlas-tree-utils';

interface TreeRendererProps {
  nodes: ProcessedAtlasNode[];
  rawNodes: Record<string, AtlasNodeData>;
  allocatedIds: Set<number>;
  onToggleNode: (nodeId: number) => void;
  searchHighlight?: string;
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

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const ZOOM_SPEED = 0.003;

function getNodeRadius(node: ProcessedAtlasNode): number {
  switch (node.nodeType) {
    case 'keystone': return 16;
    case 'notable': return 14;
    case 'mastery': return 10;
    default: return 8;
  }
}

function matchesSearch(node: ProcessedAtlasNode, query: string): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  if (node.name.toLowerCase().includes(lower)) return true;
  return node.stats.some((s) => s.toLowerCase().includes(lower));
}

function NodeShape({
  node,
  isAllocated,
  isAllocatable,
  isSearchMatch,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  node: ProcessedAtlasNode;
  isAllocated: boolean;
  isAllocatable: boolean;
  isSearchMatch: boolean;
  onMouseEnter: (e: MouseEvent<SVGElement>) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const r = getNodeRadius(node);
  const isMastery = node.nodeType === 'mastery';
  const isClickable = !isMastery && (isAllocated || isAllocatable);

  const fillColor = isAllocated ? '#AF6025' : '#3a3a3a';
  const strokeColor = isAllocated
    ? '#c8a862'
    : isAllocatable
      ? '#7a6d3a'
      : '#555';
  const strokeWidth = node.nodeType === 'notable' ? 2.5 : 1.5;

  const searchGlow = isSearchMatch && !isAllocated
    ? 'drop-shadow(0 0 6px #FFD700) drop-shadow(0 0 12px #FFD700)'
    : undefined;
  const allocatableGlow = isAllocatable && !isAllocated && !isSearchMatch
    ? 'drop-shadow(0 0 4px #7a6d3a)'
    : undefined;
  const filterStyle = searchGlow ?? allocatableGlow;

  const iconUrl = getIconUrl(node.icon);
  const iconSize = r * 2;

  if (node.nodeType === 'keystone') {
    const half = r;
    const points = `${node.x},${node.y - half} ${node.x + half},${node.y} ${node.x},${node.y + half} ${node.x - half},${node.y}`;
    return (
      <g
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={isClickable ? onClick : undefined}
        className={cn(
          'transition-colors duration-150',
          isClickable && 'cursor-pointer',
          isAllocatable && !isAllocated && 'animate-pulse',
        )}
        style={filterStyle ? { filter: filterStyle } : undefined}
      >
        <polygon
          points={points}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        {iconUrl && (
          <image
            href={iconUrl}
            x={node.x - r * 0.6}
            y={node.y - r * 0.6}
            width={r * 1.2}
            height={r * 1.2}
            style={{ pointerEvents: 'none', opacity: isAllocated ? 1 : 0.6 }}
          />
        )}
      </g>
    );
  }

  if (node.nodeType === 'mastery') {
    return (
      <g
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <circle
          cx={node.x}
          cy={node.y}
          r={r}
          fill="#2a1a3a"
          stroke="#6a4a8a"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          className="transition-colors duration-150"
        />
        {iconUrl && (
          <image
            href={iconUrl}
            x={node.x - r * 0.7}
            y={node.y - r * 0.7}
            width={r * 1.4}
            height={r * 1.4}
            style={{ pointerEvents: 'none', opacity: 0.7 }}
          />
        )}
      </g>
    );
  }

  return (
    <g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        'transition-colors duration-150',
        isClickable && 'cursor-pointer',
        isAllocatable && !isAllocated && 'animate-pulse',
      )}
      style={filterStyle ? { filter: filterStyle } : undefined}
    >
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      {iconUrl && (
        <image
          href={iconUrl}
          x={node.x - iconSize * 0.35}
          y={node.y - iconSize * 0.35}
          width={iconSize * 0.7}
          height={iconSize * 0.7}
          style={{ pointerEvents: 'none', opacity: isAllocated ? 1 : 0.5 }}
        />
      )}
    </g>
  );
}

// Tree coordinate bounds from GGG data
const TREE_MIN_X = -6200;
const TREE_MAX_X = 5900;
const TREE_MIN_Y = -11200;
const TREE_MAX_Y = 400;
const TREE_WIDTH = TREE_MAX_X - TREE_MIN_X;
const TREE_HEIGHT = TREE_MAX_Y - TREE_MIN_Y;
const TREE_CENTER_X = (TREE_MIN_X + TREE_MAX_X) / 2;
const TREE_CENTER_Y = (TREE_MIN_Y + TREE_MAX_Y) / 2;

// GGG sprite base URL for node icons
const SPRITE_BASE = 'https://web.poecdn.com/image';

function getIconUrl(icon: string): string {
  if (!icon) return '';
  return `${SPRITE_BASE}/${icon}`;
}

function clampPan(
  newPanX: number,
  newPanY: number,
  currentZoom: number,
  containerWidth: number,
  containerHeight: number,
): { panX: number; panY: number } {
  const scaledWidth = TREE_WIDTH * currentZoom;
  const scaledHeight = TREE_HEIGHT * currentZoom;

  // Allow panning only so tree edges stay at container edges (with some margin)
  const margin = 100;
  const offsetX = TREE_CENTER_X * currentZoom;
  const offsetY = TREE_CENTER_Y * currentZoom;

  const minPanX = containerWidth / 2 - scaledWidth / 2 - offsetX - margin;
  const maxPanX = containerWidth / 2 + scaledWidth / 2 - offsetX + margin;
  const minPanY = containerHeight / 2 - scaledHeight / 2 - offsetY - margin;
  const maxPanY = containerHeight / 2 + scaledHeight / 2 - offsetY + margin;

  return {
    panX: Math.max(minPanX, Math.min(maxPanX, newPanX)),
    panY: Math.max(minPanY, Math.min(maxPanY, newPanY)),
  };
}

export function TreeRenderer({
  nodes,
  rawNodes,
  allocatedIds,
  onToggleNode,
  searchHighlight,
}: TreeRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.08);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const panStateRef = useRef<PanState>({
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const didDragRef = useRef(false);
  const zoomRef = useRef(0.08);

  // Auto-fit tree to container on mount
  useEffect(() => {
    if (initialized || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / TREE_WIDTH;
    const scaleY = rect.height / TREE_HEIGHT;
    const fitZoom = Math.min(scaleX, scaleY) * 0.85;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

    const centerX = rect.width / 2 - TREE_CENTER_X * clampedZoom;
    const centerY = rect.height / 2 - TREE_CENTER_Y * clampedZoom;

    zoomRef.current = clampedZoom;
    setZoom(clampedZoom);
    setPanX(centerX);
    setPanY(centerY);
    setInitialized(true);
  }, [initialized]);

  // Native wheel event listener with passive: false so we can preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(e: globalThis.WheelEvent) {
      e.preventDefault();
      const delta = -e.deltaY * ZOOM_SPEED;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current + delta * zoomRef.current));
      zoomRef.current = newZoom;
      setZoom(newZoom);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  // Build connection lines from the `out` edges
  const connections = useMemo(() => {
    const lines: Array<{ fromId: string; toId: string; x1: number; y1: number; x2: number; y2: number }> = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      for (const outId of node.out) {
        const key = [node.id, outId].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const target = nodeMap.get(outId);
        if (!target) continue;
        lines.push({
          fromId: node.id,
          toId: outId,
          x1: node.x,
          y1: node.y,
          x2: target.x,
          y2: target.y,
        });
      }
    }
    return lines;
  }, [nodes, nodeMap]);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    panStateRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!panStateRef.current.isPanning) return;
    const dx = e.clientX - panStateRef.current.startX;
    const dy = e.clientY - panStateRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didDragRef.current = true;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clamped = clampPan(
      panStateRef.current.startPanX + dx,
      panStateRef.current.startPanY + dy,
      zoomRef.current,
      rect.width,
      rect.height,
    );
    setPanX(clamped.panX);
    setPanY(clamped.panY);
  }, []);

  const handleMouseUp = useCallback(() => {
    panStateRef.current.isPanning = false;
  }, []);

  const handleNodeEnter = useCallback((node: ProcessedAtlasNode, e: MouseEvent<SVGElement>) => {
    setTooltip({
      node,
      screenX: e.clientX,
      screenY: e.clientY,
    });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleNodeClick = useCallback((nodeId: number) => {
    if (didDragRef.current) return;
    onToggleNode(nodeId);
  }, [onToggleNode]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-poe-bg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        className="h-full w-full"
        style={{ userSelect: 'none' }}
      >
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {/* Connection lines */}
          {connections.map((conn) => {
            const bothAllocated =
              allocatedStringIds.has(conn.fromId) && allocatedStringIds.has(conn.toId);
            return (
              <line
                key={`${conn.fromId}-${conn.toId}`}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke={bothAllocated ? '#AF6025' : '#333'}
                strokeWidth={bothAllocated ? 2 : 1}
                strokeOpacity={bothAllocated ? 0.9 : 0.4}
                className="transition-colors duration-200"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isAllocated = allocatedIds.has(node.skill);
            const isAllocatable = allocatableNeighbors.has(node.id);
            const isSearchMatch = matchesSearch(node, searchHighlight ?? '');

            return (
              <NodeShape
                key={node.id}
                node={node}
                isAllocated={isAllocated}
                isAllocatable={isAllocatable}
                isSearchMatch={isSearchMatch}
                onMouseEnter={(e) => handleNodeEnter(node, e)}
                onMouseLeave={handleNodeLeave}
                onClick={() => handleNodeClick(node.skill)}
              />
            );
          })}
        </g>
      </svg>

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
          {tooltip.node.flavourText && tooltip.node.flavourText.length > 0 && (
            <p className="mt-1.5 border-t border-poe-border/30 pt-1.5 text-xs italic text-poe-unique">
              {tooltip.node.flavourText.join(' ')}
            </p>
          )}
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 rounded bg-poe-panel/80 px-2 py-1 text-xs text-poe-text-muted">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
