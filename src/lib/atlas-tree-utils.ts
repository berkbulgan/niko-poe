// ABOUTME: Pure utility functions for processing the GGG atlas passive tree data.
// ABOUTME: Handles orbital positioning, stat aggregation, BFS pathfinding, and connectivity checks.

import type {
  AtlasGroupData,
  AtlasNodeData,
  AtlasNodeType,
  AtlasTreeConstants,
  AtlasTreeRawData,
  ProcessedAtlasNode,
  AggregatedStat,
} from '@/types/atlas-tree';

// ---------------------------------------------------------------------------
// 3a. Orbit position calculator
// ---------------------------------------------------------------------------

/**
 * Calculates the x,y position of a node within its group based on orbit and index.
 * Uses the orbit radii and skills-per-orbit from GGG's constants.
 */
export function calculateNodePosition(
  group: AtlasGroupData,
  orbit: number,
  orbitIndex: number,
  constants: AtlasTreeConstants,
): { x: number; y: number } {
  const radius = constants.orbitRadii[orbit] ?? 0;
  const nodesInOrbit = constants.skillsPerOrbit[orbit] ?? 1;

  if (radius === 0) {
    return { x: group.x, y: group.y };
  }

  const angle = (2 * Math.PI * orbitIndex) / nodesInOrbit;
  return {
    x: group.x + radius * Math.sin(angle),
    y: group.y - radius * Math.cos(angle),
  };
}

// ---------------------------------------------------------------------------
// 3b. Process tree data
// ---------------------------------------------------------------------------

function resolveNodeType(node: AtlasNodeData): AtlasNodeType {
  if (node.isKeystone) return 'keystone';
  if (node.isNotable) return 'notable';
  if (node.isMastery) return 'mastery';
  return 'small';
}

/**
 * Converts the raw GGG tree export into a flat array of processed nodes with
 * calculated x,y positions and resolved node types.
 */
export function processTreeData(raw: AtlasTreeRawData): ProcessedAtlasNode[] {
  const processed: ProcessedAtlasNode[] = [];

  for (const [id, node] of Object.entries(raw.nodes)) {
    // Skip special nodes like "root" that lack standard fields
    if (!node.skill && !node.name) continue;
    const group = raw.groups[String(node.group)];
    if (!group) continue;

    const { x, y } = calculateNodePosition(
      group,
      node.orbit,
      node.orbitIndex,
      raw.constants,
    );

    processed.push({
      ...node,
      id,
      nodeType: resolveNodeType(node),
      x,
      y,
    });
  }

  return processed;
}

// ---------------------------------------------------------------------------
// 3c. Stat aggregation
// ---------------------------------------------------------------------------

const STAT_NUMBER_REGEX = /(\d+(?:\.\d+)?)\s*(%?)/;

/**
 * Parses a stat string to extract the numeric value, unit, and the template text
 * with the number removed for grouping purposes.
 */
function parseStat(stat: string): { template: string; value: number; unit: string } | undefined {
  const match = STAT_NUMBER_REGEX.exec(stat);
  if (!match) return undefined;

  const value = parseFloat(match[1]);
  const unit = match[2];
  const template = stat.replace(STAT_NUMBER_REGEX, '').trim();

  return { template, value, unit };
}

/**
 * Aggregates stats from a list of allocated nodes by grouping identical stat
 * templates and summing their numeric values.
 */
export function aggregateStats(nodes: AtlasNodeData[]): AggregatedStat[] {
  const statMap = new Map<string, AggregatedStat>();

  for (const node of nodes) {
    for (const stat of node.stats) {
      const parsed = parseStat(stat);
      if (!parsed) continue;

      const existing = statMap.get(parsed.template);
      if (existing) {
        existing.total += parsed.value;
        existing.count += 1;
      } else {
        statMap.set(parsed.template, {
          text: parsed.template,
          total: parsed.value,
          unit: parsed.unit,
          count: 1,
        });
      }
    }
  }

  return Array.from(statMap.values()).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// 3d. BFS shortest path
// ---------------------------------------------------------------------------

/**
 * Builds an undirected adjacency list from the node `in` and `out` connections.
 */
function buildAdjacencyList(
  nodes: Record<string, AtlasNodeData>,
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  for (const [id, node] of Object.entries(nodes)) {
    if (!adj.has(id)) adj.set(id, new Set());
    const neighbors = adj.get(id)!;

    for (const out of node.out) {
      neighbors.add(out);
      if (!adj.has(out)) adj.set(out, new Set());
      adj.get(out)!.add(id);
    }

    for (const inp of node.in) {
      neighbors.add(inp);
      if (!adj.has(inp)) adj.set(inp, new Set());
      adj.get(inp)!.add(id);
    }
  }

  return adj;
}

/**
 * BFS from any node in `from` to `target`. Returns the shortest path as an
 * array of node IDs (including the target, excluding already-allocated nodes).
 * Returns an empty array if no path exists.
 */
export function findShortestPath(
  nodes: Record<string, AtlasNodeData>,
  from: Set<string>,
  target: string,
): string[] {
  if (from.has(target)) return [];

  const adj = buildAdjacencyList(nodes);
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();

  const queue: string[] = [];

  for (const startId of from) {
    visited.add(startId);
    parent.set(startId, null);
    queue.push(startId);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];

    if (current === target) {
      // Reconstruct path, excluding already-allocated source nodes
      const path: string[] = [];
      let node: string | null | undefined = current;
      while (node != null && !from.has(node)) {
        path.unshift(node);
        node = parent.get(node) ?? null;
      }
      return path;
    }

    const neighbors = adj.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// 3e. Get allocatable neighbors
// ---------------------------------------------------------------------------

/**
 * Finds the starting node IDs reachable from "root" through hidden hub nodes.
 * In GGG data, root → hub (no name) → starting small passives.
 */
export function getStartingNodeIds(
  nodes: Record<string, AtlasNodeData>,
): Set<string> {
  const starting = new Set<string>();
  const root = nodes['root'];
  if (!root) return starting;

  // BFS through nodes with no name (hidden hubs) to find first real nodes
  const queue = [...root.out];
  const visited = new Set<string>(['root']);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = nodes[id];
    if (!node) continue;

    if (!node.name && !node.skill) {
      // Hidden hub — keep traversing
      queue.push(...node.out);
    } else {
      starting.add(id);
    }
  }

  return starting;
}

/**
 * Returns the set of node IDs that are adjacent to any currently allocated node
 * but are not themselves allocated. These are the valid next allocations.
 * When nothing is allocated, returns the starting nodes from root.
 */
export function getAllocatableNeighbors(
  nodes: Record<string, AtlasNodeData>,
  allocatedIds: Set<string>,
): Set<string> {
  // When nothing is allocated, offer the starting nodes
  if (allocatedIds.size === 0) {
    return getStartingNodeIds(nodes);
  }

  const neighbors = new Set<string>();

  for (const id of allocatedIds) {
    const node = nodes[id];
    if (!node) continue;

    for (const out of node.out) {
      if (!allocatedIds.has(out) && nodes[out]) {
        neighbors.add(out);
      }
    }

    for (const inp of node.in) {
      if (!allocatedIds.has(inp) && nodes[inp]) {
        neighbors.add(inp);
      }
    }
  }

  return neighbors;
}

// ---------------------------------------------------------------------------
// 3f. Can deallocate (connectivity check)
// ---------------------------------------------------------------------------

/**
 * Checks whether removing `nodeId` from `allocatedIds` would leave the
 * remaining allocated nodes connected. If deallocating would disconnect the
 * tree, returns false.
 */
export function canDeallocate(
  nodeId: string,
  allocatedIds: Set<string>,
  nodes: Record<string, AtlasNodeData>,
): boolean {
  if (!allocatedIds.has(nodeId)) return false;

  const remaining = new Set(allocatedIds);
  remaining.delete(nodeId);

  // Empty tree or single node left is always valid
  if (remaining.size <= 1) return true;

  // BFS from an arbitrary remaining node — all remaining nodes must be reachable
  const adj = buildAdjacencyList(nodes);
  const startId = remaining.values().next().value as string;
  const visited = new Set<string>();
  const queue: string[] = [startId];
  visited.add(startId);

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const neighbors = adj.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && remaining.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === remaining.size;
}
