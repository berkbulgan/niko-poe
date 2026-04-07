// ABOUTME: Type definitions for the PoE atlas passive tree data and user configurations.
// ABOUTME: Covers GGG's official tree export format plus our saved build config.

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
  flavourText?: string[];
  reminderText?: string[];
}

export interface AtlasGroupData {
  x: number;
  y: number;
  orbits: number[];
  nodes: string[];
  background?: {
    image: string;
    offset?: { x: number; y: number };
  };
}

export interface AtlasTreeConstants {
  classes: unknown[];
  characterAttributes: unknown[];
  PSSCentreInnerRadius: number;
  skillsPerOrbit: number[];
  orbitRadii: number[];
}

export interface AtlasTreeRawData {
  tree: string;
  groups: Record<string, AtlasGroupData>;
  nodes: Record<string, AtlasNodeData>;
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  constants: AtlasTreeConstants;
  points: { totalPoints: number; ascendancyPoints: number };
}

export interface AtlasTreeConfig {
  allocatedNodeIds: number[];
  treeVersion: string;
}

export interface AtlasTree {
  id: string;
  name: string;
  config: AtlasTreeConfig;
  createdAt: string;
  updatedAt: string;
}

export type AtlasNodeType = 'small' | 'notable' | 'keystone' | 'mastery';

export interface ProcessedAtlasNode extends AtlasNodeData {
  id: string;
  nodeType: AtlasNodeType;
  x: number;
  y: number;
}

export interface AggregatedStat {
  text: string;
  total: number;
  unit: string;
  count: number;
}
