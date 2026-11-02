// ABOUTME: Tests that saved map mod ids survive upstream re-ids via mod-id-aliases.json.
// ABOUTME: Uses the real bundled data, so it only asserts properties that hold for any data version.

import { describe, expect, it } from 'vitest';
import { MAP_MODS, resolveModIds } from './index';
import aliases from './mod-id-aliases.json';

describe('resolveModIds', () => {
  it('keeps current ids and drops unknown ones', () => {
    const current = MAP_MODS[0].id;
    expect(resolveModIds([current, 123456789])).toEqual([current]);
  });

  it('maps every recorded old id to a current mod', () => {
    const known = new Set(MAP_MODS.map((m) => m.id));
    for (const oldId of Object.keys(aliases)) {
      const [resolved] = resolveModIds([Number(oldId)]);
      expect(known.has(resolved)).toBe(true);
    }
  });
});
