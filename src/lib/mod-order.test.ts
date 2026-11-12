// ABOUTME: Tests for selectedFirst, which lifts selected mods to the top of a mod column.
// ABOUTME: Checks that both groups keep their incoming order.

import { describe, expect, it } from 'vitest';
import { selectedFirst } from './mod-order';

const mods = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

describe('selectedFirst', () => {
  it('puts selected mods first, keeping the order inside each group', () => {
    expect(selectedFirst(mods, new Set([4, 2])).map((m) => m.id)).toEqual([2, 4, 1, 3]);
  });
  it('returns the same order when nothing is selected', () => {
    expect(selectedFirst(mods, new Set()).map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });
});
