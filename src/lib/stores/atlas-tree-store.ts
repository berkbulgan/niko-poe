// ABOUTME: Zustand store for AtlasTree page — persists active tree selection, allocated nodes, and undo history across navigation.
// ABOUTME: Replaces local useState so node allocations and undo stack survive page unmount/remount.

import { create } from 'zustand';
import { useGameDataStore } from '@/lib/stores/game-data-store';
import { chosenVariants } from '@/lib/atlas-tree-utils';
import type { AtlasNodeData, AtlasTreeConfig } from '@/types/atlas-tree';

const MAX_HISTORY = 50;

const currentTag = () => useGameDataStore.getState().atlasTag;

interface AtlasTreeState {
  // Page-level selection
  activeTreeId: string | null;

  // Tree editor state
  allocatedIds: Set<number>;
  history: ReadonlyArray<Set<number>>;
  searchQuery: string;
  /**
   * The atlas tag the allocation's node ids belong to: the tag the open tree was loaded on, or the tag a new
   * draft got its first node on. null: an empty new draft, which follows the current tag.
   */
  editingTag: string | null;
  /** Multiple-choice notable → chosen effect. Not in undo history: a deallocated node's choice stays for undo and is dropped by getConfig. */
  variantChoices: Record<string, number>;

  // Actions
  setActiveTreeId: (id: string | null) => void;
  setAllocatedIds: (ids: Set<number>) => void;
  setSearchQuery: (query: string) => void;

  // History-aware mutations
  /** choices: variants picked for multiple-choice notables this allocation adds. */
  toggleNode: (nodeId: number, rawNodes: Record<string, AtlasNodeData>, pruneDisconnected: (nodeId: string, allocated: Set<string>, rawNodes: Record<string, AtlasNodeData>) => Set<string>, choices?: Record<string, number>) => void;
  allocatePath: (nodeIds: number[], choices?: Record<string, number>) => void;
  undo: () => void;

  // Config get/load
  /** The allocation, stamped with editingTag (the current tag for an empty new draft). */
  getConfig: () => AtlasTreeConfig;
  /** Replaces the allocation and its tag and clears undo history (opening a tree, or a new empty draft with tag null). */
  loadAllocation: (ids: number[], tag: string | null, choices?: Record<string, number>) => void;
}

export const useAtlasTreeStore = create<AtlasTreeState>((set, get) => ({
  activeTreeId: null,
  allocatedIds: new Set(),
  history: [],
  searchQuery: '',
  editingTag: null,
  variantChoices: {},

  setActiveTreeId: (id) => set({ activeTreeId: id }),
  setAllocatedIds: (ids) => set({ allocatedIds: ids }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleNode: (nodeId, rawNodes, pruneDisconnected, choices) => set((state) => {
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
      editingTag: state.editingTag ?? currentTag(),
      variantChoices: { ...state.variantChoices, ...choices },
    };
  }),

  allocatePath: (nodeIds, choices) => {
    if (nodeIds.length === 0) return;
    set((state) => {
      const next = new Set(state.allocatedIds);
      for (const id of nodeIds) next.add(id);
      return {
        history: [...state.history.slice(-(MAX_HISTORY - 1)), state.allocatedIds],
        allocatedIds: next,
        editingTag: state.editingTag ?? currentTag(),
        variantChoices: { ...state.variantChoices, ...choices },
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

  getConfig: () => ({
    allocatedNodeIds: Array.from(get().allocatedIds),
    treeVersion: get().editingTag ?? currentTag(),
    variantChoices: chosenVariants(get().variantChoices, get().allocatedIds),
  }),

  loadAllocation: (ids, tag, choices = {}) => set({
    allocatedIds: new Set(ids),
    history: [],
    editingTag: tag,
    variantChoices: choices,
  }),
}));
