// ABOUTME: Type definitions for stash snapshot configs, snapshots, and items.
// ABOUTME: Shared between hooks, stores, and UI components for the Snapshots feature.

export interface SnapshotConfig {
  id: string;
  name: string;
  league: string;
  tabIds: string[];
  strategyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSnapshotConfigInput {
  name: string;
  league: string;
  tabIds: string[];
  strategyId?: string | null;
}

export interface UpdateSnapshotConfigInput {
  name?: string;
  tabIds?: string[];
  strategyId?: string | null;
}

export interface SnapshotItem {
  id: string;
  itemName: string;
  typeLine: string;
  stackSize: number;
  chaosValue: number | null;
  frameType: number | null;
  icon: string;
}

export interface StashSnapshot {
  id: string;
  configId: string;
  label: string | null;
  totalChaos: number;
  totalItems: number;
  unpricedCount: number;
  divineRate: number;
  createdAt: string;
  items: SnapshotItem[];
}

export interface SnapshotSummary {
  id: string;
  configId: string;
  label: string | null;
  totalChaos: number;
  totalItems: number;
  unpricedCount: number;
  divineRate: number;
  createdAt: string;
}

export interface RecentSnapshot {
  id: string;
  configName: string;
  totalChaos: number;
  divineRate: number;
  totalItems: number;
  unpricedCount: number;
  createdAt: string;
}

export interface TakeSnapshotInput {
  configId: string;
  label?: string | null;
}
