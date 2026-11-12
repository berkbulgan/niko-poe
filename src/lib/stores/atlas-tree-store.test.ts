// ABOUTME: Tests which atlas tag the Atlas Tree draft is saved under when the current tag changes mid-session.
// ABOUTME: Covers an opened tree, a new draft after its first node, an empty new draft, and variant choices.

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
    expect(store().getConfig()).toEqual({ allocatedNodeIds: [1, 2, 3], treeVersion: '3.25.0', variantChoices: {} });
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

describe('atlas tree store variant choices', () => {
  beforeEach(() => setCurrentTag('3.25.0'));

  it('saves the choices of allocated nodes, and brings one back when undo re-allocates its node', () => {
    store().loadAllocation([1], '3.25.0', { 1: 5 });
    store().allocatePath([2, 3], { 3: 9 });
    expect(store().getConfig().variantChoices).toEqual({ 1: 5, 3: 9 });

    // Deallocating 3 drops its choice from the saved config; undo restores the node with it.
    store().toggleNode(3, {}, (_id, allocated) => new Set([...allocated].filter((id) => id !== '3')));
    expect(store().getConfig().variantChoices).toEqual({ 1: 5 });
    store().undo();
    expect(store().getConfig().variantChoices).toEqual({ 1: 5, 3: 9 });
  });

  it('starts from the loaded tree choices, or none', () => {
    store().loadAllocation([1], '3.25.0', { 1: 5 });
    store().loadAllocation([1], '3.25.0');
    expect(store().getConfig().variantChoices).toEqual({});
  });
});
