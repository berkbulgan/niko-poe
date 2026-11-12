// ABOUTME: Type definitions for the PoE atlas passive tree data and user configurations.
// ABOUTME: Covers GGG's official tree export format (league.json) plus our saved build config.

// ---------------------------------------------------------------------------
// Sprite sheet types
// ---------------------------------------------------------------------------

/** A single sprite's position and size within a sprite sheet. */
export interface SpriteCoord {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One zoom-level entry for a sprite category. */
export interface SpriteZoomEntry {
  filename: string;
  w: number;
  h: number;
  coords: Record<string, SpriteCoord>;
}

/** Sprite categories keyed by zoom level string (e.g. "0.1246"). */
export type SpriteCategory = Record<string, SpriteZoomEntry>;

/** All sprite categories in the GGG export. */
export interface AtlasSprites {
  background: SpriteCategory;
  normalActive: SpriteCategory;
  notableActive: SpriteCategory;
  keystoneActive: SpriteCategory;
  wormholeActive: SpriteCategory;
  normalInactive: SpriteCategory;
  notableInactive: SpriteCategory;
  keystoneInactive: SpriteCategory;
  wormholeInactive: SpriteCategory;
  mastery: SpriteCategory;
  masteryOverlay: SpriteCategory;
  groupBackground: SpriteCategory;
  startNode: SpriteCategory;
  frame: SpriteCategory;
  line: SpriteCategory;
  atlasBackground: SpriteCategory;
}

// ---------------------------------------------------------------------------
// Node & group types
// ---------------------------------------------------------------------------

export interface AtlasNodeData {
  skill: number;
  name: string;
  icon: string;
  stats: string[];
  group: number;
  orbit: number;
  orbitIndex: number;
  out: string[];
  in: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isWormhole?: boolean;
  flavourText?: string[];
  reminderText?: string[];
  /** Since 3.30: alternative stats a node can roll. */
  variantEffects?: Array<{ stats: string[]; effect: number; reminderText?: string[] }>;
  /** Since 3.30: connections drawn as an arc around a given centre instead of the group's. */
  connections?: Array<{ to: string; orbit: number; orbitX?: number; orbitY?: number }>;
}

export interface AtlasGroupData {
  x: number;
  y: number;
  orbits: number[];
  nodes: string[];
  background?: {
    image: string;
    offsetX?: number;
    offsetY?: number;
  };
}

export interface AtlasTreeConstants {
  classes: unknown[];
  characterAttributes: unknown[];
  PSSCentreInnerRadius: number;
  skillsPerOrbit: number[];
  orbitRadii: number[];
}

// ---------------------------------------------------------------------------
// Raw data (league.json)
// ---------------------------------------------------------------------------

export interface AtlasTreeRawData {
  tree: string;
  groups: Record<string, AtlasGroupData>;
  nodes: Record<string, AtlasNodeData>;
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  constants: AtlasTreeConstants;
  sprites: AtlasSprites;
  imageZoomLevels: number[];
  points: { totalPoints: number; ascendancyPoints: number };
}

// ---------------------------------------------------------------------------
// Processed / UI types
// ---------------------------------------------------------------------------

export type AtlasNodeType = 'small' | 'notable' | 'keystone' | 'mastery' | 'wormhole';

export interface ProcessedAtlasNode extends AtlasNodeData {
  id: string;
  nodeType: AtlasNodeType;
  x: number;
  y: number;
}

export interface AtlasTreeConfig {
  allocatedNodeIds: number[];
  treeVersion: string;
  /** Multiple-choice notable (node id) → the variantEffects effect picked for it. Absent on older trees. */
  variantChoices?: Record<string, number>;
}

export interface AtlasTree {
  id: string;
  name: string;
  config: AtlasTreeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AggregatedStat {
  /** The stat line with "#" where the number was (sign and unit excluded). */
  text: string;
  total: number;
  unit: string;
  count: number;
  /** The source line wrote an explicit sign ("+16%"), so a positive total shows a "+". */
  signed: boolean;
}

// ---------------------------------------------------------------------------
// Rendering types
// ---------------------------------------------------------------------------

/** Connection between two nodes for rendering. */
export interface AtlasConnection {
  fromId: string;
  toId: string;
  fromNode: ProcessedAtlasNode;
  toNode: ProcessedAtlasNode;
  /** True when the connection is drawn as an orbit arc (same group and orbit, or a centre given by the data). */
  sameOrbit: boolean;
  /** Arc centre from the data (3.30+ `connections`); otherwise arcs use the group centre. */
  arcCenter?: { x: number; y: number };
}
