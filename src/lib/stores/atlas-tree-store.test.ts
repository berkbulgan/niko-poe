// ABOUTME: Tests which atlas tag the Atlas Tree draft is saved under when the current tag changes mid-session.
// ABOUTME: Covers an opened tree, a new draft after its first node, and an empty new draft.

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameDataStore } from '@/lib/stores/game-data-store';
import { useAtlasTreeStore } from './atlas-tree-store';

const store = () => useAtlasTreeStore.getState();
const setCurrentTag = (atlasTag: string) => useGameDataStore.setState({ atlasTag });

describe('atlas tree store editingTag', () => {
  beforeEach(() => setCurrentTag('3.25.0'));

  it('keeps the tag an opened tree was loaded on', () => {
    store().loadAllocation([1, 2], '3.25.0');
    setCurrentTag('3.26.0');
    store().allocatePath([3]);
    expect(store().getConfig()).toEqual({ allocatedNodeIds: [1, 2, 3], treeVersion: '3.25.0' });
  });

  it('pins a new draft to the tag of its first node', () => {
    store().loadAllocation([], null);
    store().toggleNode(1, {}, () => new Set());
    setCurrentTag('3.26.0');
    expect(store().getConfig().treeVersion).toBe('3.25.0');
  });

  it('moves an empty new draft to the current tag', () => {
    store().loadAllocation([], null);
    setCurrentTag('3.26.0');
    store().allocatePath([1]);
    expect(store().getConfig().treeVersion).toBe('3.26.0');
  });
});
