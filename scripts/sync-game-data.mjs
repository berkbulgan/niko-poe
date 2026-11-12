// ABOUTME: Refreshes the app's bundled fallback game data by hand: the latest atlas tree (GGG atlastree-export, with its
// ABOUTME: release date) and map-mod regex data (data.poe.re); adds a CHANGELOG entry, prints a summary. --dry-run writes nothing.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  checkAtlas, checkMapMods, insertChangelogEntry, latestTag, modIdAliases, nextPatchVersion, sha256For,
  summarizeAtlas, summarizeMapMods,
} from './game-data.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ATLAS_REPO = 'grindinggear/atlastree-export';
const POE_RE_DATA = 'https://data.poe.re';
const MAP_MODS_PATH = 'mapmods/Generated.Map.ENGLISH.json';

const dryRun = process.argv.includes('--dry-run');

// data.poe.re asks every client for a `<name>/<version> (<url>)` User-Agent. The GitHub token only goes to GitHub.
const USER_AGENT = 'niko-data-sync/1.0 (https://github.com/berkbulgan/niko-poe)';
const headersFor = (url) => ({
  'User-Agent': USER_AGENT,
  ...(process.env.GITHUB_TOKEN && new URL(url).hostname.endsWith('github.com') && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
});

async function get(url) {
  const res = await fetch(url, { headers: headersFor(url) });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res;
}
const getJson = async (url) => (await get(url)).json();
const getText = async (url) => (await get(url)).text();
const getBytes = async (url) => Buffer.from(await (await get(url)).arrayBuffer());

const file = (p) => path.join(ROOT, p);
const readJson = async (p) => JSON.parse(await readFile(file(p), 'utf8'));
const writeJson = (p, data) => writeFile(file(p), JSON.stringify(data, null, 2) + '\n');

const sources = await readJson('src/data/sources.json');
const changelog = [];
const problems = [];

// --- Atlas tree: follow GGG's release tags so preview trees (untagged commits) are skipped ---
const tags = await getJson(`https://api.github.com/repos/${ATLAS_REPO}/tags?per_page=100`);
const atlasTag = latestTag(tags.map((t) => t.name));
if (atlasTag && atlasTag !== sources.atlasTag) {
  const raw = await getBytes(`https://raw.githubusercontent.com/${ATLAS_REPO}/${atlasTag}/data.json`);
  const next = JSON.parse(raw.toString('utf8'));
  const prev = await readJson('src/data/atlas-tree-data.json');
  const assets = await getJson(`https://api.github.com/repos/${ATLAS_REPO}/contents/assets?ref=${atlasTag}`);

  problems.push(...checkAtlas(next, Object.keys(prev.nodes).length, assets.map((a) => a.name)));
  changelog.push(summarizeAtlas(prev, next, atlasTag));
  if (!dryRun) {
    // Written byte-for-byte so diffs against upstream stay readable.
    await writeFile(file('src/data/atlas-tree-data.json'), raw);
    for (const asset of assets) {
      await writeFile(file(`public/atlas/${asset.name}`), await getBytes(asset.download_url));
    }
  }
  sources.atlasTag = atlasTag;
  // The app maps trees saved before tags were recorded to a patch by this date.
  const commit = await getJson(`https://api.github.com/repos/${ATLAS_REPO}/commits/${atlasTag}`);
  sources.atlasReleasedAt = commit.commit.committer.date;
}

// --- Map mod regex: the English map-mods file of data.poe.re's current PoE 1 patch ---
// SHA256SUMS is tiny, so a day without changes costs two small requests and no download.
const { current } = await getJson(`${POE_RE_DATA}/current.json`);
const patch = current.poe1.patch;
const patchUrl = `${POE_RE_DATA}/generated/poe1/${patch}`;
const sha256 = sha256For(await getText(`${patchUrl}/SHA256SUMS`), MAP_MODS_PATH);
if (!sha256) throw new Error(`${MAP_MODS_PATH} is not listed in ${patchUrl}/SHA256SUMS`);
if (sha256 !== sources.poeReSha256) {
  const raw = await getBytes(`${patchUrl}/${MAP_MODS_PATH}`);
  const actual = createHash('sha256').update(raw).digest('hex');
  if (actual !== sha256) throw new Error(`${MAP_MODS_PATH} checksum mismatch: expected ${sha256}, got ${actual}`);
  const next = JSON.parse(raw.toString('utf8'));
  const prevTokens = await readJson('src/data/map-mods-full.json');
  const prevTable = await readJson('src/data/optimization-table.json');

  const nextTokens = Array.isArray(next.tokens) ? next.tokens : [];
  // Saved presets store mod ids; keep them pointing at the same mods when upstream re-ids them.
  const aliases = modIdAliases(prevTokens, nextTokens);
  const line = summarizeMapMods(prevTokens, nextTokens, prevTable, next.optimizationTable, aliases);
  // Upstream changes that don't touch fields we use are ignored (and re-checked next run).
  if (line) {
    problems.push(...checkMapMods(next, prevTokens.length));
    const remapped = Object.keys(aliases).length;
    changelog.push(remapped ? `${line}; ${remapped} saved mod ids remapped` : line);
    if (!dryRun) {
      await writeJson('src/data/map-mods-full.json', next.tokens);
      await writeJson('src/data/optimization-table.json', next.optimizationTable);
      await writeJson('src/data/mod-id-aliases.json', { ...(await readJson('src/data/mod-id-aliases.json')), ...aliases });
    }
    sources.poeRePatch = patch;
    sources.poeReSha256 = sha256;
  }
}

const changed = changelog.length > 0;
const valid = problems.length === 0;

if (changed && !dryRun) {
  await writeJson('src/data/sources.json', sources);
  const { version } = await readJson('package.json');
  const today = new Date().toISOString().slice(0, 10);
  const text = await readFile(file('CHANGELOG.md'), 'utf8');
  await writeFile(file('CHANGELOG.md'), insertChangelogEntry(text, nextPatchVersion(version), today, changelog));
}

const summary = changed
  ? [...changelog.map((l) => `- ${l}`), ...(valid ? [] : ['', '**Problems:**', ...problems.map((p) => `- ${p}`)])].join('\n')
  : 'No changes.';
console.log(summary);
