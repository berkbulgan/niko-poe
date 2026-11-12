// ABOUTME: Tests for presetRegex: empty configs give no regex, and the output matches what StatPicker built inline.
// ABOUTME: Uses the real bundled map mod data.

import { describe, expect, it } from 'vitest';
import { hasRegexFilter, presetRegex } from './preset-regex';
import { MAP_MODS } from '@/data';
import { buildOptimizedVendorRegex } from '@/lib/optimize-regex';
import { generateNumberRegex } from '@/lib/generate-number-regex';
import type { FilterPresetConfig } from '@/types/filters';

// Spelled out: EMPTY_FILTERS in filters-store is a MapStatFilters (no mod ids) and its mapTier is '16'.
const empty: FilterPresetConfig = {
  quantity: '',
  packSize: '',
  rarity: '',
  mapTier: '',
  quality: '',
  qualityType: 'pack_size',
  moreCurrency: '',
  moreMaps: '',
  moreScarabs: '',
  moreDivination: '',
  corrupted: 'natural',
  isNightmareMap: false,
  avoidModIds: [],
  preferModIds: [],
};

describe('presetRegex', () => {
  it('gives an empty string for an empty config', () => {
    expect(hasRegexFilter(empty)).toBe(false);
    expect(presetRegex(empty)).toBe('');
  });

  it('ignores the trade-only map tier', () => {
    const config = { ...empty, mapTier: '16' };
    expect(hasRegexFilter(config)).toBe(false);
    expect(presetRegex(config)).toBe('');
  });

  it('matches the regex StatPicker built before the move', () => {
    const mod = MAP_MODS[0];
    const config = { ...empty, quantity: '80', avoidModIds: [mod.id] };
    expect(hasRegexFilter(config)).toBe(true);
    expect(presetRegex(config)).toBe(
      buildOptimizedVendorRegex([mod], [], ['"m q.*' + generateNumberRegex('80', false) + '%"']),
    );
  });
});
