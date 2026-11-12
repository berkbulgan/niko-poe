// ABOUTME: Tests for the pure atlas tree helpers: config equality, search, cycling, bounds, mechanic grouping, patch tags and migration.
// ABOUTME: Uses small hand-built node graphs, plus one sanity check against the bundled GGG tree data.

import { describe, expect, it } from 'vitest';
import {
  aggregateStats,
  atlasConfigsEqual,
  boundsOf,
  clampPan,
  buildConnections,
  chosenVariants,
  cleanTreeText,
  cycleIndex,
  formatStatLine,
  formatStatTotal,
  backgroundRect,
  getStartPosition,
  groupByMechanic,
  isEmptyAtlasConfig,
  keepChoices,
  jumpBox,
  mechanicCoreNodeIds,
  migrateTree,
  nodeMechanics,
  pickAtlasTag,
  processTreeData,
  resolveTreeTag,
  stripMarkup,
  searchMatches,
  statsText,
} from './atlas-tree-utils';
import rawTreeData from '@/data/atlas-tree-data.json';
import sources from '@/data/sources.json';
import type { AtlasNodeData, AtlasTreeRawData, ProcessedAtlasNode } from '@/types/atlas-tree';
import type { AtlasVersion } from '@/types/game-data';

function node(skill: number, extra: Partial<AtlasNodeData> = {}): AtlasNodeData {
  return { skill, name: `Node ${skill}`, icon: '', stats: [], group: 0, orbit: 0, orbitIndex: 0, out: [], in: [], ...extra };
}

function pnode(skill: number, extra: Partial<ProcessedAtlasNode> = {}): ProcessedAtlasNode {
  return { ...node(skill), id: String(skill), nodeType: 'small', x: 0, y: 0, ...extra };
}

/** Keys nodes by String(skill) ("root" for skill 0) and links each [from, to] pair through out/in. */
function graph(list: AtlasNodeData[], edges: Array<[string, string]>): Record<string, AtlasNodeData> {
  const nodes: Record<string, AtlasNodeData> = {};
  for (const n of list) nodes[n.skill === 0 ? 'root' : String(n.skill)] = n;
  for (const [from, to] of edges) {
    nodes[from].out.push(to);
    nodes[to].in.push(from);
  }
  return nodes;
}

describe('atlasConfigsEqual', () => {
  it('ignores node order and tree version', () => {
    expect(atlasConfigsEqual(
      { allocatedNodeIds: [3, 1, 2], treeVersion: 'a' },
      { allocatedNodeIds: [1, 2, 3], treeVersion: 'b' },
    )).toBe(true);
  });
  it('detects a different set', () => {
    expect(atlasConfigsEqual({ allocatedNodeIds: [1, 2], treeVersion: 'a' }, { allocatedNodeIds: [1, 3], treeVersion: 'a' })).toBe(false);
    expect(atlasConfigsEqual({ allocatedNodeIds: [1], treeVersion: 'a' }, { allocatedNodeIds: [1, 2], treeVersion: 'a' })).toBe(false);
  });
  it('compares variant choices, with a missing map equal to an empty one', () => {
    const a = { allocatedNodeIds: [1], treeVersion: 'a' };
    expect(atlasConfigsEqual(a, { ...a, variantChoices: {} })).toBe(true);
    expect(atlasConfigsEqual({ ...a, variantChoices: { 1: 7 } }, { ...a, variantChoices: { 1: 7 } })).toBe(true);
    expect(atlasConfigsEqual({ ...a, variantChoices: { 1: 7 } }, { ...a, variantChoices: { 1: 8 } })).toBe(false);
    expect(atlasConfigsEqual({ ...a, variantChoices: { 1: 7 } }, a)).toBe(false);
  });
  it('treats null as different from any config', () => {
    expect(atlasConfigsEqual({ allocatedNodeIds: [], treeVersion: 'a' }, null)).toBe(false);
    expect(atlasConfigsEqual(null, null)).toBe(true);
  });
});

describe('chosenVariants', () => {
  it('keeps the choices of allocated nodes only', () => {
    expect(chosenVariants({ 1: 7, 2: 8 }, [1, 3])).toEqual({ 1: 7 });
    expect(chosenVariants(undefined, [1])).toEqual({});
  });
});

describe('keepChoices', () => {
  it('keeps a choice when the node was kept and still offers that variant', () => {
    const next = {
      '1': node(1, { variantEffects: [{ stats: ['a'], effect: 7 }] }),
      '2': node(2, { variantEffects: [{ stats: ['b'], effect: 9 }] }),
      '3': node(3, { variantEffects: [{ stats: ['c'], effect: 5 }] }),
    };
    expect(keepChoices({ 1: 7, 2: 8, 3: 5 }, [1, 2], next)).toEqual({ 1: 7 });
  });
});

describe('isEmptyAtlasConfig', () => {
  it('is true only with no allocated nodes', () => {
    expect(isEmptyAtlasConfig({ allocatedNodeIds: [], treeVersion: 'a' })).toBe(true);
    expect(isEmptyAtlasConfig({ allocatedNodeIds: [7], treeVersion: 'a' })).toBe(false);
  });
});

describe('searchMatches', () => {
  const nodes = [
    pnode(1, { name: 'Breach Hands', stats: ['Delirium Encounters have 10% more fog'] }),
    pnode(2, { name: 'Zany Delirium', isNotable: true, nodeType: 'notable' }),
    pnode(3, { name: 'Delirium Fog' }),
    pnode(4, { name: 'Delirium', isMastery: true, nodeType: 'mastery' }),
    pnode(5, { name: '', stats: ['Delirium hub'] }),
    pnode(6, { name: 'Ascend Delirium', isKeystone: true, nodeType: 'keystone' }),
    pnode(7, { name: 'Delirium Fog' }),
    pnode(8, { name: 'Strongbox Hoard' }),
  ];

  it('matches name or stat line, notables and keystones first, then by name and id', () => {
    expect(searchMatches(nodes, '  DELIRIUM ').map((n) => n.id)).toEqual(['6', '2', '1', '3', '7']);
  });
  it('returns nothing for a blank query', () => {
    expect(searchMatches(nodes, '   ')).toEqual([]);
  });
});

describe('stripMarkup', () => {
  it('keeps the display text of [Id|Display] and [Id] links', () => {
    expect(stripMarkup('+1% [SurpassChance|Surpassing Chance] for [ContainsAbyss|Abysses]')).toBe('+1% Surpassing Chance for Abysses');
    expect(stripMarkup('contain a [Mirage]')).toBe('contain a Mirage');
    expect(stripMarkup('no markup here')).toBe('no markup here');
  });
});

describe('cleanTreeText', () => {
  const raw = {
    nodes: {
      1: node(1, {
        stats: ['[ContainsAbyss|Abysses] in your Maps'],
        reminderText: ['([SurpassChance|Surpassing Chance] is rolled first)'],
        flavourText: ['The [Mirage] fades'],
        variantEffects: [{ stats: ['contain a [DemonicEvocator|Demonic Evocator]'], effect: 7 }],
      }),
      2: node(2),
    },
  } as unknown as AtlasTreeRawData;
  const cleaned = cleanTreeText(raw);

  it('strips markup from stats, reminder, flavour and variant effect text', () => {
    expect(cleaned.nodes[1].stats).toEqual(['Abysses in your Maps']);
    expect(cleaned.nodes[1].reminderText).toEqual(['(Surpassing Chance is rolled first)']);
    expect(cleaned.nodes[1].flavourText).toEqual(['The Mirage fades']);
    expect(cleaned.nodes[1].variantEffects).toEqual([{ stats: ['contain a Demonic Evocator'], effect: 7 }]);
    expect(cleaned.nodes[2]).toEqual(node(2));
  });
  it('leaves the input untouched', () => {
    expect(raw.nodes[1].stats).toEqual(['[ContainsAbyss|Abysses] in your Maps']);
  });
  it('lets search match the display text of the bundled data', () => {
    const nodes = processTreeData(cleanTreeText(rawTreeData as unknown as AtlasTreeRawData));
    expect(searchMatches(nodes, 'Abysses').length).toBeGreaterThan(0);
    expect(searchMatches(nodes, 'ContainsAbyss')).toEqual([]);
  });
});

describe('cycleIndex', () => {
  it('starts at either end when nothing is selected', () => {
    expect(cycleIndex(-1, 3, 1)).toBe(0);
    expect(cycleIndex(-1, 3, -1)).toBe(2);
  });
  it('steps and wraps at both ends', () => {
    expect(cycleIndex(0, 3, 1)).toBe(1);
    expect(cycleIndex(2, 3, 1)).toBe(0);
    expect(cycleIndex(0, 3, -1)).toBe(2);
  });
  it('returns -1 for an empty list', () => {
    expect(cycleIndex(-1, 0, 1)).toBe(-1);
    expect(cycleIndex(2, 0, -1)).toBe(-1);
  });
});

describe('boundsOf', () => {
  it('returns null for no points', () => {
    expect(boundsOf([])).toBeNull();
  });
  it('spans all points', () => {
    expect(boundsOf([{ x: 1, y: 5 }, { x: -2, y: 3 }, { x: 0, y: 9 }])).toEqual({ minX: -2, minY: 3, maxX: 1, maxY: 9 });
  });
});

describe('jumpBox', () => {
  // Group 1 near the origin, group 2 just right of it, group 3 far away.
  const points = [
    { x: 0, y: 0, group: 1 }, { x: 10, y: 10, group: 1 },
    { x: 20, y: 0, group: 2 }, { x: 30, y: 10, group: 2 },
    { x: 1000, y: 1000, group: 3 }, { x: 1010, y: 1010, group: 3 },
  ];

  it('returns null for no points', () => {
    expect(jumpBox([], { x: 0, y: 0 }, 100, 100)).toBeNull();
  });
  it('frames every point when they all fit', () => {
    expect(jumpBox(points, { x: 0, y: 0 }, 2000, 2000)).toEqual({ minX: 0, minY: 0, maxX: 1010, maxY: 1010 });
  });
  it('otherwise frames the group nearest the view, widened with nearby groups that still fit', () => {
    expect(jumpBox(points, { x: 0, y: 0 }, 100, 100)).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 10 });
    expect(jumpBox(points, { x: 900, y: 900 }, 100, 100)).toEqual({ minX: 1000, minY: 1000, maxX: 1010, maxY: 1010 });
  });
  it('keeps the nearest group alone when no other group fits with it', () => {
    expect(jumpBox(points, { x: 0, y: 0 }, 15, 15)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
});

describe('nodeMechanics', () => {
  // root -> hub 1 -> 10 (group 2, Breach) and 20 (group 3, Delirium).
  // 30 (no mastery) touches 11 (Breach) and 20 (Delirium); 31 hangs off 30.
  // 40 is only reachable through the hub; 51 only through wormhole 50.
  const nodes = graph(
    [
      node(0, { name: '' }),
      node(1, { name: '', group: 1 }),
      node(10, { group: 2 }),
      node(11, { group: 2, isNotable: true }),
      node(100, { name: 'Breach', group: 2, isMastery: true }),
      node(20, { group: 3 }),
      node(200, { name: 'Delirium', group: 3, isMastery: true }),
      node(30, { group: 4 }),
      node(31, { group: 4 }),
      node(40, { group: 5 }),
      node(50, { name: 'Gateway', group: 6, isWormhole: true }),
      node(51, { group: 7 }),
    ],
    [['root', '1'], ['1', '10'], ['1', '20'], ['1', '40'], ['10', '11'], ['20', '30'], ['11', '30'], ['30', '31'], ['20', '50'], ['50', '51']],
  );
  const mechanics = nodeMechanics(nodes);

  it('gives a node the mastery name of its own group', () => {
    expect(mechanics.get('10')).toBe('Breach');
    expect(mechanics.get('11')).toBe('Breach');
    expect(mechanics.get('20')).toBe('Delirium');
  });
  it('gives other nodes the nearest mapped neighbour, ties to the lowest id', () => {
    expect(mechanics.get('30')).toBe('Breach');
    expect(mechanics.get('31')).toBe('Breach');
  });
  it('never maps or crosses root, hubs, masteries and wormholes', () => {
    for (const id of ['root', '1', '100', '200', '50', '40', '51']) expect(mechanics.has(id)).toBe(false);
  });
  it('maps every real node with stats except masteries and wormholes', () => {
    const real = (rawTreeData as unknown as AtlasTreeRawData).nodes;
    const realMechanics = nodeMechanics(real);
    const unmapped = Object.entries(real)
      .filter(([id, n]) => id !== 'root' && n.stats.length > 0 && !n.isMastery && !n.isWormhole && !realMechanics.has(id))
      .map(([id]) => id);
    expect(unmapped).toEqual([]);
  });
});

describe('mechanicCoreNodeIds', () => {
  // Breach masteries sit in groups 2 and 4; 12 is a path node outside them that nodeMechanics would spread to.
  const nodes = graph(
    [
      node(0, { name: '' }),
      node(1, { name: '', group: 2 }),
      node(10, { group: 2 }),
      node(11, { group: 4 }),
      node(12, { group: 5 }),
      node(13, { name: 'Gateway', group: 2, isWormhole: true }),
      node(100, { name: 'Breach', group: 2, isMastery: true }),
      node(101, { name: 'Breach', group: 4, isMastery: true }),
      node(20, { group: 3 }),
      node(200, { name: 'Delirium', group: 3, isMastery: true }),
    ],
    [['root', '1'], ['1', '10'], ['1', '20'], ['10', '12'], ['12', '11'], ['10', '13']],
  );
  const core = mechanicCoreNodeIds(nodes);

  it('takes only the nodes in the groups holding the mastery, not the paths between them', () => {
    expect([...(core.get('Breach') ?? [])].sort()).toEqual(['10', '11']);
    expect(core.get('Delirium')).toEqual(['20']);
  });
  it('leaves out hubs, masteries and wormholes', () => {
    const all = [...core.values()].flat();
    for (const id of ['root', '1', '13', '100', '101', '200', '12']) expect(all).not.toContain(id);
  });
});

describe('groupByMechanic', () => {
  const mechanics = new Map([['10', 'Breach'], ['11', 'Breach'], ['12', 'Breach'], ['20', 'Delirium'], ['21', 'Abyss']]);
  const allocated = [
    node(5, { name: 'Keystone K', isKeystone: true }),
    node(6, { name: 'Mastery', isMastery: true }),
    node(10, { stats: ['5% increased Quantity'] }),
    node(11, { name: 'Breach notable', isNotable: true, stats: ['Breaches have 20% more monsters'] }),
    node(12, { stats: ['3% increased Quantity'] }),
    node(20),
    node(21),
    node(96),
    node(97),
    node(98),
    node(99),
  ];
  const { keystones, sections } = groupByMechanic(allocated, mechanics);

  it('lists keystones apart and skips masteries', () => {
    expect(keystones.map((n) => n.name)).toEqual(['Keystone K']);
    expect(sections.reduce((sum, s) => sum + s.points, 0)).toBe(9);
  });
  it('sorts by points, then name, with Other last', () => {
    expect(sections.map((s) => [s.mechanic, s.points])).toEqual([['Breach', 3], ['Abyss', 1], ['Delirium', 1], ['Other', 4]]);
  });
  it('splits notables from aggregated small stats', () => {
    expect(sections[0].notables.map((n) => n.name)).toEqual(['Breach notable']);
    expect(sections[0].smallStats).toEqual([{ text: '# increased Quantity', total: 8, unit: '%', count: 2, signed: false }]);
  });
});

describe('aggregateStats', () => {
  it('keeps the sign out of the template and sums signed values', () => {
    const stats = aggregateStats([
      node(1, { stats: ['Your Maps have +6% chance to contain Ore Deposits'] }),
      node(2, { stats: ['Your Maps have +10% chance to contain Ore Deposits'] }),
      node(3, { stats: ['+2% increased Quantity of Items found in your Maps', '-1 to maximum Seals'] }),
      node(4, { stats: ['+3% increased Quantity of Items found in your Maps', '-2 to maximum Seals'] }),
    ]);
    expect(stats).toEqual([
      { text: 'Your Maps have # chance to contain Ore Deposits', total: 16, unit: '%', count: 2, signed: true },
      { text: '# increased Quantity of Items found in your Maps', total: 5, unit: '%', count: 2, signed: true },
      { text: '# to maximum Seals', total: -3, unit: '', count: 2, signed: true },
    ]);
  });
});

describe('formatStatTotal', () => {
  it('adds the unit and a plus sign when the stat had one, rounding to two decimals', () => {
    expect(formatStatTotal({ text: 'x', total: 12, unit: '%', count: 2, signed: true })).toBe('+12%');
    expect(formatStatTotal({ text: 'x', total: 1.256, unit: '', count: 1, signed: true })).toBe('+1.26');
    expect(formatStatTotal({ text: 'x', total: -5, unit: '%', count: 1, signed: true })).toBe('-5%');
    expect(formatStatTotal({ text: 'x', total: 8, unit: '%', count: 2, signed: false })).toBe('8%');
  });
});

describe('formatStatLine', () => {
  it('puts the summed value where the number was', () => {
    expect(formatStatLine({ text: 'Your Maps have # chance to contain Ore Deposits', total: 16, unit: '%', count: 2, signed: true }))
      .toBe('Your Maps have +16% chance to contain Ore Deposits');
    expect(formatStatLine({ text: 'Beyond Portals in your Maps have # increased Merging Radius', total: 16, unit: '%', count: 2, signed: false }))
      .toBe('Beyond Portals in your Maps have 16% increased Merging Radius');
  });
});

describe('statsText', () => {
  it('writes the header, keystones and one block per section', () => {
    const text = statsText('My tree', 12, 132, [node(5, { name: 'Keystone K' })], [
      {
        mechanic: 'Breach',
        points: 3,
        notables: [node(11, { name: 'Breach notable' })],
        smallStats: [
          { text: '# increased Quantity', total: 8, unit: '%', count: 2, signed: true },
          { text: 'Your Maps have # chance to contain Ore Deposits', total: 16, unit: '%', count: 2, signed: true },
        ],
      },
      { mechanic: 'Other', points: 1, notables: [], smallStats: [] },
    ]);
    expect(text).toBe(
      'My tree — 12/132 points\n\nKeystones\n- Keystone K\n\nBreach (3)\n- Breach notable\n+8% increased Quantity\n'
        + 'Your Maps have +16% chance to contain Ore Deposits\n\nOther (1)',
    );
  });
  it('adds the chosen variant after a multiple-choice notable', () => {
    const notable = node(11, { name: 'Unthreaded', stats: ['Threads cannot be of type'], variantEffects: [{ stats: ['Abyss'], effect: 7 }] });
    const text = statsText('T', 1, 132, [], [{ mechanic: 'Delirium', points: 1, notables: [notable], smallStats: [] }], { 11: 7 });
    expect(text).toBe('T — 1/132 points\n\nDelirium (1)\n- Unthreaded: Abyss');
  });
  it('leaves out the keystones block when there are none', () => {
    expect(statsText('Atlas tree', 0, 132, [], [])).toBe('Atlas tree — 0/132 points');
  });
});

const V3301: AtlasVersion = { tag: '3.30.0', releasedAt: '2026-11-12T04:34:53Z' };
const V3291: AtlasVersion = { tag: '3.29.1', releasedAt: '2026-07-31T00:27:57Z' };

describe('resolveTreeTag', () => {
  const legacy = (updatedAt?: string) => ({ config: { allocatedNodeIds: [], treeVersion: 'Atlas' }, updatedAt });
  const V3280: AtlasVersion = { tag: '3.28.0', releasedAt: '2026-03-01T00:00:00Z' };

  it('passes an X.Y.Z tree version through', () => {
    expect(resolveTreeTag({ config: { allocatedNodeIds: [], treeVersion: '3.28.0' }, updatedAt: '2026-12-01 00:00:00' }, [V3301])).toBe('3.28.0');
  });
  it('maps a legacy tree to the newest tag released at or before its last update (SQLite dates are UTC)', () => {
    expect(resolveTreeTag(legacy('2026-11-12 04:00:00'), [V3301, V3291, V3280])).toBe('3.29.1');
    expect(resolveTreeTag(legacy('2026-07-31T00:27:57Z'), [V3301, V3291, V3280])).toBe('3.29.1');
    expect(resolveTreeTag(legacy('2026-07-30 23:00:00'), [V3301, V3291, V3280])).toBe('3.28.0');
  });
  it('never maps a legacy tree past the bundled tag, even when updated after a newer release', () => {
    const bundled: AtlasVersion = { tag: sources.atlasTag, releasedAt: sources.atlasReleasedAt };
    const newer: AtlasVersion = { tag: '99.0.0', releasedAt: '2099-01-01T00:00:00Z' };
    expect(resolveTreeTag(legacy('2099-06-01 00:00:00'), [bundled, newer])).toBe(sources.atlasTag);
  });
  it('returns null for an unknown older patch or a tree without a date', () => {
    expect(resolveTreeTag(legacy('2026-07-30 23:00:00'), [V3301, V3291])).toBeNull();
    expect(resolveTreeTag(legacy(), [V3301, V3291])).toBeNull();
  });
});

describe('migrateTree', () => {
  // root → hub 1 (nameless) → 10 → 11 → 12, mastery 30 hangs off 11, 20 off the hub.
  const edges: Array<[string, string]> = [['root', '1'], ['1', '10'], ['10', '11'], ['11', '12'], ['11', '30'], ['1', '20']];
  function treeWithout(missing: string[]): Record<string, AtlasNodeData> {
    const list = [node(0), node(1, { name: '' }), node(10), node(11), node(12), node(20), node(30, { isMastery: true })]
      .filter((n) => !missing.includes(String(n.skill)));
    return graph(list, edges.filter(([a, b]) => !missing.includes(a) && !missing.includes(b)));
  }
  const allocated = [10, 11, 12, 30, 99, 1];

  it('keeps nodes that still exist and drops missing ids, hubs and masteries', () => {
    expect(migrateTree(allocated, treeWithout([]))).toEqual({ kept: [10, 11, 12], removed: [30, 99, 1] });
  });
  it('drops nodes cut off from root by a removal', () => {
    expect(migrateTree(allocated, treeWithout(['11']))).toEqual({ kept: [10], removed: [11, 12, 30, 99, 1] });
  });
});

describe('pickAtlasTag', () => {
  const V3310: AtlasVersion = { tag: '3.31.0', releasedAt: '2027-03-01T00:00:00Z' };
  const V3280: AtlasVersion = { tag: '3.28.0', releasedAt: '2026-03-01T00:00:00Z' };

  it('takes the newest tag whose files load, trying one tag at a time', async () => {
    const tried: string[] = [];
    const tag = await pickAtlasTag([V3301, V3310, V3291], V3291, async (t) => { tried.push(t); return t === '3.30.0'; });
    expect(tag).toBe('3.30.0');
    expect(tried).toEqual(['3.31.0', '3.30.0']);
  });
  it('stops at the bundled tag without loading it', async () => {
    const tried: string[] = [];
    expect(await pickAtlasTag([V3301, V3291], V3291, async (t) => { tried.push(t); return false; })).toBe('3.29.1');
    expect(tried).toEqual(['3.30.0']);
  });
  it('ignores tags older than the bundled one and falls back to it', async () => {
    const tried: string[] = [];
    expect(await pickAtlasTag([V3280], V3291, async (t) => { tried.push(t); return true; })).toBe('3.29.1');
    expect(await pickAtlasTag([], V3291, async () => true)).toBe('3.29.1');
    expect(tried).toEqual([]);
  });
});

describe('backgroundRect', () => {
  const bounds = { minX: -6868, maxX: 6953, minY: -14073, maxY: 269 };

  it('stretches a picture background over the tree bounds (3.29.1 and older)', () => {
    const r = backgroundRect(bounds, { x: 42, y: -6724 }, false);
    expect(r.cx).toBeCloseTo(42.5);
    expect(r.cy).toBeCloseTo(-6902);
    expect(r.w / r.h).toBeCloseTo((6953 + 6868) / (269 + 14073));
  });

  it('centres a square ring background on the start and keeps it square (3.30)', () => {
    const r = backgroundRect(bounds, { x: 42, y: -6724 }, true);
    expect(r).toMatchObject({ cx: 42, cy: -6724 });
    expect(r.w).toBe(r.h);
    // Still covers the whole tree from the off-centre start.
    expect(r.cy - r.h / 2).toBeLessThan(bounds.minY);
    expect(r.cy + r.h / 2).toBeGreaterThan(bounds.maxY);
  });
});

describe('getStartPosition', () => {
  const node = (over: Partial<AtlasNodeData>): AtlasNodeData =>
    ({ skill: 0, name: '', icon: '', stats: [], group: 0, orbit: 0, orbitIndex: 0, out: [], in: [], ...over }) as AtlasNodeData;

  it('is the hub group centre, near the origin on the bundled 3.29.1 tree', () => {
    const d = rawTreeData as unknown as AtlasTreeRawData;
    const p = getStartPosition(d.nodes, d.groups);
    expect(Math.abs(p.x)).toBeLessThan(5);
    expect(Math.abs(p.y)).toBeLessThan(5);
  });

  it('follows the hub when its group moves (3.30 put the start in the middle)', () => {
    const nodes = {
      root: node({ out: ['10'] }),
      '10': node({ skill: 10, group: 7, out: ['11'] }),
      '11': node({ skill: 11, name: 'Start', group: 8, in: ['10'] }),
    };
    const groups = { '7': { x: 42, y: -6724, orbits: [0], nodes: ['10'] }, '8': { x: 0, y: 0, orbits: [0], nodes: ['11'] } };
    expect(getStartPosition(nodes, groups)).toEqual({ x: 42, y: -6724 });
  });

  it('falls back to the origin when there is no hub', () => {
    expect(getStartPosition({}, {})).toEqual({ x: 0, y: 0 });
  });
});

describe('buildConnections arc centres', () => {
  const pnode = (id: string, over: Partial<ProcessedAtlasNode>): ProcessedAtlasNode =>
    ({ id, skill: Number(id), name: id, icon: '', stats: [], group: 1, orbit: 1, orbitIndex: 0, out: [], in: [],
      nodeType: 'small', x: 0, y: 0, ...over }) as ProcessedAtlasNode;

  it('uses the arc centre the data gives for a cross-group connection', () => {
    const a = pnode('1', { group: 1, out: ['2'], connections: [{ to: '2', orbit: 2, orbitX: 5, orbitY: 6 }] });
    const b = pnode('2', { group: 2, in: ['1'] });
    const [conn] = buildConnections([a, b], new Map([['1', a], ['2', b]]));
    expect(conn.arcCenter).toEqual({ x: 5, y: 6 });
    expect(conn.sameOrbit).toBe(true);
  });

  it('finds the centre when it is listed on the target node', () => {
    const a = pnode('1', { group: 1, out: ['2'] });
    const b = pnode('2', { group: 2, in: ['1'], connections: [{ to: '1', orbit: 2, orbitX: -3, orbitY: 4 }] });
    const [conn] = buildConnections([a, b], new Map([['1', a], ['2', b]]));
    expect(conn.arcCenter).toEqual({ x: -3, y: 4 });
  });

  it('keeps straight lines and group arcs as before', () => {
    const a = pnode('1', { group: 1, orbit: 1, out: ['2', '3'] });
    const b = pnode('2', { group: 1, orbit: 1 });
    const c = pnode('3', { group: 2, orbit: 1 });
    const conns = buildConnections([a, b, c], new Map([['1', a], ['2', b], ['3', c]]));
    expect(conns.map((x) => [x.toId, x.sameOrbit, x.arcCenter])).toEqual([['2', true, undefined], ['3', false, undefined]]);
  });
});

describe('clampPan', () => {
  const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

  it('keeps a tree larger than the viewport inside its 10% margin', () => {
    // zoom 1: tree is 1000px in a 500px viewport, so pan x ranges over [500-1000-100, 0+100]
    expect(clampPan(500, -9999, 1, 500, 500, bounds)).toEqual({ x: 100, y: -600 });
  });

  it('centres a tree that fits in the viewport with room to spare', () => {
    // zoom 0.1: tree is 100px in an 800x400 viewport, so it sits in the middle
    expect(clampPan(0, 0, 0.1, 800, 400, bounds)).toEqual({ x: 350, y: 150 });
  });
});
