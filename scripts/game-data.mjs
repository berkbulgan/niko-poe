// ABOUTME: Pure helpers for the game-data sync: upstream data validation, changelog summaries, version text.
// ABOUTME: Kept free of I/O so it can be unit-tested; sync-game-data.mjs does the fetching and writing.

// Mirrors AtlasSprites in src/types/atlas-tree.ts — the renderer reads every one of these.
export const KNOWN_SPRITE_CATEGORIES = [
  'background', 'normalActive', 'notableActive', 'keystoneActive', 'wormholeActive',
  'normalInactive', 'notableInactive', 'keystoneInactive', 'wormholeInactive',
  'mastery', 'masteryOverlay', 'groupBackground', 'startNode', 'frame', 'line', 'atlasBackground',
];

const MAX_DROP = 0.1;

export function latestTag(names) {
  const parse = (n) => n.split('.').map(Number);
  const tags = names.filter((n) => /^\d+\.\d+\.\d+$/.test(n));
  tags.sort((a, b) => {
    const [x, y] = [parse(a), parse(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  return tags.at(-1) ?? null;
}

function spriteFileNames(sprites) {
  const names = new Set();
  for (const category of Object.values(sprites)) {
    for (const entry of Object.values(category)) {
      names.add(entry.filename.split('?')[0].split('/').pop());
    }
  }
  return names;
}

export function checkAtlas(next, prevNodeCount, assetNames) {
  const missing = ['nodes', 'groups', 'sprites', 'constants', 'imageZoomLevels'].filter((k) => !(k in next));
  if (missing.length) return missing.map((k) => `atlas: missing key "${k}"`);

  const problems = [];
  const count = Object.keys(next.nodes).length;
  if (count < prevNodeCount * (1 - MAX_DROP)) {
    problems.push(`atlas: node count dropped from ${prevNodeCount} to ${count}`);
  }
  for (const category of Object.keys(next.sprites)) {
    if (!KNOWN_SPRITE_CATEGORIES.includes(category)) problems.push(`atlas: unknown sprite category "${category}"`);
  }
  for (const category of KNOWN_SPRITE_CATEGORIES) {
    if (!(category in next.sprites)) problems.push(`atlas: missing sprite category "${category}"`);
  }
  const assets = new Set(assetNames);
  for (const name of spriteFileNames(next.sprites)) {
    if (!assets.has(name)) problems.push(`atlas: sprite file "${name}" not in assets`);
  }
  return problems;
}

export function checkMapMods(next, prevTokenCount) {
  if (!Array.isArray(next.tokens)) return ['map mods: tokens is not an array'];

  const problems = [];
  const bad = next.tokens.filter((t) =>
    typeof t.id !== 'number' || typeof t.regex !== 'string' || typeof t.rawText !== 'string'
    || typeof t.generalizedText !== 'string' || typeof t.options?.scary !== 'number');
  if (bad.length) problems.push(`map mods: ${bad.length} tokens have an unexpected shape`);

  const table = next.optimizationTable;
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    problems.push('map mods: optimizationTable is not an object');
  }
  if (next.tokens.length < prevTokenCount * (1 - MAX_DROP)) {
    problems.push(`map mods: token count dropped from ${prevTokenCount} to ${next.tokens.length}`);
  }
  return problems;
}

export function summarizeAtlas(prev, next, tag) {
  const before = new Set(Object.keys(prev.nodes));
  const after = new Set(Object.keys(next.nodes));
  const added = [...after].filter((id) => !before.has(id)).length;
  const removed = [...before].filter((id) => !after.has(id)).length;
  return `Atlas tree data updated to ${tag} (+${added} / -${removed} nodes)`;
}

// Only the fields src/data/index.ts reads count as a change.
const usedFields = (t) => JSON.stringify([t.regex, t.rawText, t.generalizedText, t.options?.scary, t.options?.nm]);

export function summarizeMapMods(prevTokens, nextTokens, prevTable, nextTable) {
  const before = new Map(prevTokens.map((t) => [t.id, usedFields(t)]));
  const after = new Map(nextTokens.map((t) => [t.id, usedFields(t)]));
  const added = [...after.keys()].filter((id) => !before.has(id)).length;
  const removed = [...before.keys()].filter((id) => !after.has(id)).length;
  const changed = [...after].filter(([id, v]) => before.has(id) && before.get(id) !== v).length;

  if (added || removed || changed) {
    return `Map mod regex data updated (${added} added, ${removed} removed, ${changed} changed)`;
  }
  if (JSON.stringify(prevTable) !== JSON.stringify(nextTable)) return 'Map mod regex optimization table updated';
  return null;
}

export function nextPatchVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

export function insertChangelogEntry(text, version, date, lines) {
  const entry = `## [${version}] - ${date}\n\n### Changed\n${lines.map((l) => `- ${l}`).join('\n')}\n\n`;
  const at = text.indexOf('## [');
  return at === -1 ? text + entry : text.slice(0, at) + entry + text.slice(at);
}
