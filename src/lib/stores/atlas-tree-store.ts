// ABOUTME: Zustand store for AtlasTree page — persists active tree selection, allocated nodes, and undo history across navigation.
// ABOUTME: Replaces local useState so node allocations and undo stack survive page unmount/remount.

import { create } from 'zustand';
import type { AtlasTreeConfig } from '@/types/atlas-tree';

const MAX_HISTORY = 50;

interface AtlasTreeState {
  // Page-level selection
  activeTreeId: string | null;

  // Tree editor state
  allocatedIds: Set<number>;
  history: ReadonlyArray<Set<number>>;
  searchQuery: string;

  // Actions
  setActiveTreeId: (id: string | null) => void;
  setAllocatedIds: (ids: Set<number>) => void;
  setSearchQuery: (query: string) => void;

  // History-aware mutations
  toggleNode: (nodeId: number, rawNodes: Record<string, { out?: string[] }>, pruneDisconnected: (nodeId: string, allocated: Set<string>, rawNodes: Record<string, { out?: string[] }>) => Set<string>) => void;
  allocatePath: (nodeIds: number[]) => void;
  undo: () => void;
  reset: () => void;

  // Config get/load
  getConfig: (treeVersion: string) => AtlasTreeConfig;
  loadTree: (treeId: string, allocatedNodeIds: number[]) => void;
}

export const useAtlasTreeStore = create<AtlasTreeState>((set, get) => ({
  activeTreeId: null,
  allocatedIds: new Set(),
  history: [],
  searchQuery: '',

  setActiveTreeId: (id) => set({ activeTreeId: id }),
  setAllocatedIds: (ids) => set({ allocatedIds: ids }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleNode: (nodeId, rawNodes, pruneDisconnected) => set((state) => {
    const prev = state.allocatedIds;
    if (prev.has(nodeId)) {
      const stringIds = new Set(Array.from(prev).map(String));
      const reachable = pruneDisconnected(String(nodeId), stringIds, rawNodes);
      return {
        history: [...state.history.slice(-(MAX_HISTORY - 1)), prev],
        allocatedIds: new Set(Array.from(reachable).map(Number)),
      };
    }
    const next = new Set(prev);
    next.add(nodeId);
    return {
      history: [...state.history.slice(-(MAX_HISTORY - 1)), prev],
      allocatedIds: next,
    };
  }),

  allocatePath: (nodeIds) => {
    if (nodeIds.length === 0) return;
    set((state) => {
      const next = new Set(state.allocatedIds);
      for (const id of nodeIds) next.add(id);
      return {
        history: [...state.history.slice(-(MAX_HISTORY - 1)), state.allocatedIds],
        allocatedIds: next,
      };
    });
  },

  undo: () => set((state) => {
    if (state.history.length === 0) return state;
    const previous = state.history[state.history.length - 1];
    return {
      history: state.history.slice(0, -1),
      allocatedIds: previous,
    };
  }),

  reset: () => set((state) => {
    if (state.allocatedIds.size === 0) return state;
    return {
      history: [...state.history.slice(-(MAX_HISTORY - 1)), state.allocatedIds],
      allocatedIds: new Set(),
    };
  }),

  getConfig: (treeVersion) => ({
    allocatedNodeIds: Array.from(get().allocatedIds),
    treeVersion,
  }),

  loadTree: (treeId, allocatedNodeIds) => set({
    activeTreeId: treeId,
    allocatedIds: new Set(allocatedNodeIds),
    history: [],
  }),
}));
