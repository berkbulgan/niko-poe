// ABOUTME: Autosaves the Atlas Tree draft through useEntityAutosave: updates the open tree 500 ms after the
// ABOUTME: last change, or creates an "Untitled tree" on the first allocation when none is open.

import * as ipc from '@/lib/ipc';
import { useAtlasTreeStore } from '@/lib/stores/atlas-tree-store';
import { atlasConfigsEqual, isEmptyAtlasConfig, resolveTreeTag } from '@/lib/atlas-tree-utils';
import { useEntityAutosave, type AutosaveAdapter } from '@/lib/hooks/use-entity-autosave';
import { useGameDataStore } from '@/lib/stores/game-data-store';
import type { AtlasTreeConfig } from '@/types/atlas-tree';

const atlasAdapter: AutosaveAdapter<AtlasTreeConfig> = {
  subscribe: (listener) => useAtlasTreeStore.subscribe(listener),
  getActiveId: () => useAtlasTreeStore.getState().activeTreeId,
  setActiveId: (id) => useAtlasTreeStore.getState().setActiveTreeId(id),
  // Saves carry the tag the tree was opened on, even if the current tag changed since (the tree is then read-only).
  getConfig: () => useAtlasTreeStore.getState().getConfig(),
  // A legacy tree (no tag saved) is editable only when its guessed tag is the current one.
  loadConfig: (config) => useAtlasTreeStore.getState().loadAllocation(
    config.allocatedNodeIds,
    resolveTreeTag({ config }, []) ?? useGameDataStore.getState().atlasTag,
    config.variantChoices,
  ),
  clear: () => useAtlasTreeStore.getState().loadAllocation([], null),
  equal: atlasConfigsEqual,
  isEmpty: isEmptyAtlasConfig,
  create: (name, config) => ipc.createAtlasTree({ name, config: JSON.stringify(config) }),
  update: async (id, config) => { await ipc.updateAtlasTree(id, { config: JSON.stringify(config) }); },
  untitledBase: 'Untitled tree',
  queryKey: ['atlas-trees'],
  errorMessage: 'Could not save atlas tree',
  logTag: '[AtlasTree]',
};

export function useAtlasAutosave(treeNames: string[]) {
  return useEntityAutosave(atlasAdapter, treeNames);
}
