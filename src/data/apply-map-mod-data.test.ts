// ABOUTME: Tests applyMapModData: server map mod data replaces the bundled data only when its shape is valid.
// ABOUTME: Also checks that server aliases are merged over the bundled ones and identity aliases are harmless.

import { describe, expect, it } from 'vitest';
import { applyMapModData, MAP_MODS, OPTIMIZATION_TABLE, resolveModIds } from './index';
import bundledAliases from './mod-id-aliases.json';
import type { MapModData } from '@/types/game-data';

const mod = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  regex: `r${id}`,
  rawText: `Mod ${id}`,
  generalizedText: `^mod ${id}$`,
  options: { scary: 100 },
  ...extra,
});

const data = (tokens: unknown[], aliases: Record<string, number> = {}): MapModData => ({
  patch: '3.30.0.1',
  sha256: 'abc',
  tokens,
  optimizationTable: {},
  aliases,
});

describe('applyMapModData', () => {
  it('swaps MAP_MODS and OPTIMIZATION_TABLE for valid data', () => {
    const table = { '1:2': { ids: [1, 2], regex: 'x', weight: 1, count: 2 } };
    const next = { ...data([mod(1), mod(2, { options: { scary: 1200 } })]), optimizationTable: table };
    expect(applyMapModData(next)).toBe(true);
    expect(MAP_MODS.map((m) => m.id)).toEqual([1, 2]);
    expect(MAP_MODS[0]).toEqual({
      id: 1, regex: 'r1', text: 'Mod 1', generalizedText: '^mod 1$', scary: 100, isNightmare: false,
    });
    expect(MAP_MODS[1].isNightmare).toBe(true);
    expect(OPTIMIZATION_TABLE).toBe(table);
    expect(resolveModIds([1, 999])).toEqual([1]);
  });

  it('rejects invalid shapes and keeps the current data', () => {
    expect(applyMapModData(data([mod(1)]))).toBe(true);
    const before = MAP_MODS;
    expect(applyMapModData(data([{ ...mod(2), regex: 5 }]))).toBe(false);
    expect(applyMapModData(data([{ ...mod(3), generalizedText: undefined }]))).toBe(false);
    expect(applyMapModData(data([{ ...mod(4), options: {} }]))).toBe(false);
    expect(applyMapModData(data([null]))).toBe(false);
    expect(applyMapModData(data([]))).toBe(false);
    expect(applyMapModData({ ...data([mod(5)]), optimizationTable: null })).toBe(false);
    expect(applyMapModData({ ...data([mod(5)]), optimizationTable: [] })).toBe(false);
    expect(MAP_MODS).toBe(before);
    expect(resolveModIds([1, 5])).toEqual([1]);
  });

  it('merges aliases with the server winning over bundled ones', () => {
    const [[overriddenOld], [keptOld, keptNew]] = Object.entries(bundledAliases);
    const aliases = { [overriddenOld]: 77, '5': 88, '88': 88 };
    expect(applyMapModData(data([mod(keptNew), mod(77), mod(88)], aliases))).toBe(true);
    expect(resolveModIds([Number(overriddenOld)])).toEqual([77]);
    expect(resolveModIds([Number(keptOld)])).toEqual([keptNew]);
    expect(resolveModIds([5, 88])).toEqual([88]);
  });
});
