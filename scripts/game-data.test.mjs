// ABOUTME: Tests for the pure game-data sync helpers (validation, summaries, changelog text).
// ABOUTME: Network and file I/O in sync-game-data.mjs are exercised with --dry-run instead.

import { describe, expect, it } from 'vitest';
import {
  KNOWN_SPRITE_CATEGORIES,
  checkAtlas,
  checkMapMods,
  insertChangelogEntry,
  latestTag,
  modIdAliases,
  nextPatchVersion,
  sha256For,
  summarizeAtlas,
  summarizeMapMods,
} from './game-data.mjs';

const sprite = (file) => ({ '0.1246': { filename: `https://web.poecdn.com/image/x/${file}?abc`, w: 1, h: 1, coords: {} } });

function atlas(nodeIds, extraSprites = {}) {
  const sprites = Object.fromEntries(KNOWN_SPRITE_CATEGORIES.map((c) => [c, sprite(`${c}.png`)]));
  return {
    nodes: Object.fromEntries(nodeIds.map((id) => [id, { name: id }])),
    groups: {},
    sprites: { ...sprites, ...extraSprites },
    constants: {},
    imageZoomLevels: [0.1246],
  };
}
const allAssets = KNOWN_SPRITE_CATEGORIES.map((c) => `${c}.png`);

const token = (id, regex, scary = 100) => ({
  id, regex, rawText: `mod ${id}`, generalizedText: `^mod ${id}$`, options: { scary, nm: false },
});

describe('latestTag', () => {
  it('picks the highest semver tag and ignores others', () => {
    expect(latestTag(['3.9.0', '3.29.1', '3.29.0', 'preview', '3.28.0'])).toBe('3.29.1');
  });
  it('returns null when nothing matches', () => {
    expect(latestTag(['preview'])).toBeNull();
  });
});

describe('checkAtlas', () => {
  it('accepts well-formed data', () => {
    expect(checkAtlas(atlas(['1', '2']), 2, allAssets)).toEqual([]);
  });
  it('reports a missing top-level key', () => {
    const data = atlas(['1']);
    delete data.sprites;
    expect(checkAtlas(data, 1, allAssets)).toEqual(['atlas: missing key "sprites"']);
  });
  it('reports a node count drop over 10%', () => {
    expect(checkAtlas(atlas(['1', '2', '3', '4', '5', '6', '7', '8']), 10, allAssets))
      .toContain('atlas: node count dropped from 10 to 8');
  });
  it('reports unknown and missing sprite categories', () => {
    const data = atlas(['1'], { newThing: sprite('new.png') });
    delete data.sprites.mastery;
    const problems = checkAtlas(data, 1, [...allAssets, 'new.png']);
    expect(problems).toContain('atlas: unknown sprite category "newThing"');
    expect(problems).toContain('atlas: missing sprite category "mastery"');
  });
  it('reports sprite files missing from assets', () => {
    expect(checkAtlas(atlas(['1']), 1, allAssets.slice(1)))
      .toContain(`atlas: sprite file "${allAssets[0]}" not in assets`);
  });
});

describe('checkMapMods', () => {
  it('accepts well-formed data', () => {
    expect(checkMapMods({ tokens: [token(1, 'a')], optimizationTable: {} }, 1)).toEqual([]);
  });
  it('rejects non-array tokens', () => {
    expect(checkMapMods({ tokens: {}, optimizationTable: {} }, 1)).toEqual(['map mods: tokens is not an array']);
  });
  it('reports bad token shape, bad table and a count drop', () => {
    const problems = checkMapMods({ tokens: [{ id: 'x' }], optimizationTable: [] }, 10);
    expect(problems).toContain('map mods: 1 tokens have an unexpected shape');
    expect(problems).toContain('map mods: optimizationTable is not an object');
    expect(problems).toContain('map mods: token count dropped from 10 to 1');
  });
});

describe('summarizeAtlas', () => {
  it('counts added and removed nodes', () => {
    expect(summarizeAtlas(atlas(['1', '2']), atlas(['2', '3', '4']), '3.29.1'))
      .toBe('Atlas tree data updated to 3.29.1 (+2 / -1 nodes)');
  });
});

describe('summarizeMapMods', () => {
  const table = { a: { ids: [1], regex: 'a', weight: 1, count: 1 } };
  it('returns null when nothing the app uses changed', () => {
    const prev = [token(1, 'a')];
    const next = [{ ...token(1, 'a'), options: { scary: 100, nm: false, rewards: [] } }];
    expect(summarizeMapMods(prev, next, table, structuredClone(table))).toBeNull();
  });
  it('counts added, removed and changed tokens', () => {
    const prev = [token(1, 'a'), token(2, 'b'), token(3, 'c')];
    const next = [token(1, 'a'), token(2, 'bb'), token(4, 'd')];
    expect(summarizeMapMods(prev, next, table, table))
      .toBe('Map mod regex data updated (1 added, 1 removed, 1 changed)');
  });
  it('reports a table-only change', () => {
    expect(summarizeMapMods([token(1, 'a')], [token(1, 'a')], table, {}))
      .toBe('Map mod regex optimization table updated');
  });
});

describe('modIdAliases', () => {
  const mod = (id, rawText, generalizedText) => ({ id, regex: 'x', rawText, generalizedText, options: { scary: 1 } });

  it('maps a reordered multi-line mod and a retuned mod to their new ids', () => {
    const prev = [
      mod(1, 'A (1-2)%|B', '^a #%$|^b$'),
      mod(2, '(30-40)% more Life', '^#% more life$'),
      mod(3, 'Kept', '^kept$'),
      mod(4, 'Gone', '^gone$'),
    ];
    const next = [
      mod(10, 'B|A (1-2)%', '^b$|^a #%$'),
      mod(20, '(90-100)% more Life', '^#% more life$'),
      mod(3, 'Kept', '^kept$'),
    ];
    expect(modIdAliases(prev, next)).toEqual({ 1: 10, 2: 20 });
  });

  it('never aliases to an ambiguous match', () => {
    const prev = [mod(1, '(1-2)% more Life', '^#% more life$')];
    const next = [mod(10, '(3-4)% more Life', '^#% more life$'), mod(11, '(5-6)% more Life', '^#% more life$')];
    expect(modIdAliases(prev, next)).toEqual({});
  });

  it('lets summarizeMapMods count remapped ids as the same mod', () => {
    const prev = [token(1, 'a')];
    expect(summarizeMapMods(prev, [{ ...token(1, 'a'), id: 2 }], {}, {}, { 1: 2 })).toBeNull();
    expect(summarizeMapMods(prev, [{ ...token(1, 'b'), id: 2 }], {}, {}, { 1: 2 }))
      .toBe('Map mod regex data updated (0 added, 0 removed, 1 changed)');
  });
});

describe('nextPatchVersion', () => {
  it('bumps the patch number', () => {
    expect(nextPatchVersion('0.3.9')).toBe('0.3.10');
  });
});

describe('insertChangelogEntry', () => {
  const head = '# Changelog\n\nIntro.\n\n';
  it('inserts above the newest release', () => {
    const text = `${head}## [0.3.0] - 2026-11-02\n\n- old\n`;
    expect(insertChangelogEntry(text, '0.3.1', '2026-11-03', ['one', 'two'])).toBe(
      `${head}## [0.3.1] - 2026-11-03\n\n### Changed\n- one\n- two\n\n## [0.3.0] - 2026-11-02\n\n- old\n`,
    );
  });
  it('appends when there is no release yet', () => {
    expect(insertChangelogEntry(head, '0.0.1', '2026-11-03', ['one'])).toBe(
      `${head}## [0.0.1] - 2026-11-03\n\n### Changed\n- one\n\n`,
    );
  });
});

describe('sha256For', () => {
  const sums = [
    'e809c1bed515dc84a95e0c1a2ef647b4a3c9f5d6c178dabd996719de547f08e8  mapmods/Generated.Map.ENGLISH.json',
    'ea5c17b8c43cae31c470b0b1baf2cd31c47a7cc60d8c5577fe87f378caab89ec  mapmods/Generated.Map.ENGLISH.min.json',
    '',
  ].join('\n');
  it('finds the hash of an exact path', () => {
    expect(sha256For(sums, 'mapmods/Generated.Map.ENGLISH.json')).toBe(
      'e809c1bed515dc84a95e0c1a2ef647b4a3c9f5d6c178dabd996719de547f08e8',
    );
  });
  it('returns null for a path that is not listed', () => {
    expect(sha256For(sums, 'mapmods/Generated.Map.GERMAN.json')).toBeNull();
  });
  it('accepts binary-mode entries and CRLF line ends', () => {
    expect(sha256For('abc123 *mapmods/x.json\r\n', 'mapmods/x.json')).toBe('abc123');
  });
});
