// ABOUTME: Tests for the Filters autosave helpers: untitled naming, empty-config and equality checks.
// ABOUTME: Pure functions only; the hook that uses them has no DOM test harness.

import { describe, expect, it } from 'vitest';
import { configsEqual, isEmptyConfig, untitledName } from './filters-autosave';
import { EMPTY_FILTERS } from '@/lib/stores/filters-store';
import type { FilterPresetConfig } from '@/types/filters';

const empty: FilterPresetConfig = { ...EMPTY_FILTERS, isNightmareMap: false, avoidModIds: [], preferModIds: [] };

describe('untitledName', () => {
  it('uses the bare name when free', () => {
    expect(untitledName([])).toBe('Untitled preset');
    expect(untitledName(['Breach'])).toBe('Untitled preset');
  });
  it('numbers from 2 and fills the smallest gap', () => {
    expect(untitledName(['Untitled preset'])).toBe('Untitled preset 2');
    expect(untitledName(['Untitled preset', 'Untitled preset 3'])).toBe('Untitled preset 2');
    expect(untitledName(['Untitled preset', 'Untitled preset 2'])).toBe('Untitled preset 3');
  });
  it('uses the given base name', () => {
    expect(untitledName(['Untitled preset'], 'Untitled tree')).toBe('Untitled tree');
    expect(untitledName(['Untitled tree', 'Untitled tree 3'], 'Untitled tree')).toBe('Untitled tree 2');
    expect(untitledName(['Untitled tree', 'Untitled tree 2'], 'Untitled tree')).toBe('Untitled tree 3');
  });
});

describe('isEmptyConfig', () => {
  it('is true for the cleared config', () => {
    expect(isEmptyConfig(empty)).toBe(true);
  });
  it('is false once anything is set', () => {
    expect(isEmptyConfig({ ...empty, avoidModIds: [7] })).toBe(false);
    expect(isEmptyConfig({ ...empty, quantity: '80' })).toBe(false);
    expect(isEmptyConfig({ ...empty, isNightmareMap: true })).toBe(false);
  });
});

describe('configsEqual', () => {
  it('ignores key order', () => {
    const reordered = Object.fromEntries(Object.entries(empty).reverse()) as unknown as FilterPresetConfig;
    expect(configsEqual(empty, reordered)).toBe(true);
  });
  it('detects a changed field', () => {
    expect(configsEqual(empty, { ...empty, rarity: '50' })).toBe(false);
    expect(configsEqual(empty, { ...empty, preferModIds: [3] })).toBe(false);
  });
  it('treats null as different from any config', () => {
    expect(configsEqual(empty, null)).toBe(false);
    expect(configsEqual(null, null)).toBe(true);
  });
});
