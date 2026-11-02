// ABOUTME: Pulls the latest atlas tree (GGG atlastree-export) and map-mod regex data (poe.re)
// ABOUTME: into the repo, adds a CHANGELOG entry and reports changed/valid. --dry-run writes nothing.

import { appendFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  checkAtlas, checkMapMods, insertChangelogEntry, latestTag, nextPatchVersion, summarizeAtlas, summarizeMapMods,
} from './game-data.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ATLAS_REPO = 'grindinggear/atlastree-export';
const POE_RE_REPO = 'veiset/poe.re';
const MAP_MODS_PATH = 'poe/generated/mapmods/Generated.Map.ENGLISH.json';

const dryRun = process.argv.includes('--dry-run');
const summaryIndex = process.argv.indexOf('--summary');
const summaryFile = summaryIndex > -1 ? process.argv[summaryIndex + 1] : null;

const headers = {
  'User-Agent': 'niko-data-sync',
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
};

async function get(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res;
}
const getJson = async (url) => (await get(url)).json();
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
}

// --- Map mod regex: latest commit that touched the English map-mods file ---
const [commit] = await getJson(`https://api.github.com/repos/${POE_RE_REPO}/commits?path=${MAP_MODS_PATH}&per_page=1`);
if (commit.sha !== sources.poeReSha) {
  const next = await getJson(`https://raw.githubusercontent.com/${POE_RE_REPO}/${commit.sha}/${MAP_MODS_PATH}`);
  const prevTokens = await readJson('src/data/map-mods-full.json');
  const prevTable = await readJson('src/data/optimization-table.json');

  const line = summarizeMapMods(prevTokens, next.tokens ?? [], prevTable, next.optimizationTable);
  // Upstream commits that don't touch fields we use are ignored (and re-checked next run).
  if (line) {
    problems.push(...checkMapMods(next, prevTokens.length));
    changelog.push(line);
    if (!dryRun) {
      await writeJson('src/data/map-mods-full.json', next.tokens);
      await writeJson('src/data/optimization-table.json', next.optimizationTable);
    }
    sources.poeReSha = commit.sha;
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
if (summaryFile) await writeFile(summaryFile, summary + '\n');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nvalid=${valid}\n`);
