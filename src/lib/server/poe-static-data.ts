// ABOUTME: In-memory cache for PoE trade stat definitions — fetches from GGG stats endpoint.
// ABOUTME: Provides search/match utilities to map regex patterns and mod text to stat IDs.

const BASE_URL = process.env.POE_TRADE_API_URL ?? 'https://www.pathofexile.com/api/trade';
const CACHE_TTL_MS = 3600000; // 1 hour

interface PoeStat {
  id: string;
  text: string;
  type: string;
}

interface StatsApiLabel {
  id?: string;
  text?: string;
  type?: string;
}

interface StatsApiGroup {
  label?: string;
  entries?: StatsApiLabel[];
}

interface StatsApiResponse {
  result?: StatsApiGroup[];
}

let cachedStats: PoeStat[] = [];
let cacheTime = 0;

const FALLBACK_STATS: PoeStat[] = [
  { id: 'explicit.stat_1940865751', text: '#% increased Pack Size', type: 'explicit' },
  { id: 'explicit.stat_3299347043', text: '#% increased Quantity of Items found in this Area', type: 'explicit' },
  { id: 'explicit.stat_1523484623', text: '#% increased Rarity of Items found in this Area', type: 'explicit' },
  { id: 'explicit.stat_2954116742', text: '#% more Monster Life', type: 'explicit' },
  { id: 'explicit.stat_3291658075', text: '#% increased Monster Damage', type: 'explicit' },
  { id: 'explicit.stat_1509134228', text: 'Players are Cursed with Temporal Chains', type: 'explicit' },
  { id: 'explicit.stat_1675539069', text: '#% increased Area of Effect', type: 'explicit' },
  { id: 'explicit.stat_2923486259', text: 'Area is inhabited by # additional Rogue Exiles', type: 'explicit' },
  { id: 'explicit.stat_3642528642', text: '#% increased Experience gain', type: 'explicit' },
  { id: 'explicit.stat_1786812858', text: 'Players have #% less Recovery Rate of Life and Energy Shield', type: 'explicit' },
  { id: 'explicit.stat_2563183002', text: 'Monsters reflect #% of Elemental Damage', type: 'explicit' },
  { id: 'explicit.stat_2067062068', text: 'Monsters reflect #% of Physical Damage', type: 'explicit' },
  { id: 'explicit.stat_3767873853', text: '#% increased number of Rare Monsters', type: 'explicit' },
  { id: 'explicit.stat_587431675', text: '#% increased number of Magic Monsters', type: 'explicit' },
  { id: 'explicit.stat_1443108510', text: 'Area contains many Totems', type: 'explicit' },
  { id: 'explicit.stat_3477714116', text: 'Monsters fire # additional Projectiles', type: 'explicit' },
  { id: 'explicit.stat_1447600567', text: 'Monsters have #% increased Critical Strike Chance', type: 'explicit' },
  { id: 'explicit.stat_2511217560', text: '#% increased Monster Movement Speed', type: 'explicit' },
  { id: 'explicit.stat_2301191210', text: '#% increased Monster Attack Speed', type: 'explicit' },
  { id: 'explicit.stat_2610364655', text: '#% increased Monster Cast Speed', type: 'explicit' },
  { id: 'explicit.stat_4015621042', text: 'Unique Boss deals #% increased Damage', type: 'explicit' },
  { id: 'explicit.stat_1196847542', text: 'Unique Boss has #% increased Life', type: 'explicit' },
  { id: 'explicit.stat_3159649497', text: 'Unique Boss has #% increased Area of Effect', type: 'explicit' },
  { id: 'explicit.stat_2422197212', text: 'Unique Boss has #% increased Attack and Cast Speed', type: 'explicit' },
  { id: 'explicit.stat_3005586429', text: 'Map has # additional random Modifiers', type: 'explicit' },
];

async function fetchStatsFromApi(): Promise<PoeStat[]> {
  const url = `${BASE_URL}/../data/stats`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CADIRO-TradeHelper/0.1.0' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  const data = (await res.json()) as StatsApiResponse;
  const groups = Array.isArray(data.result) ? data.result : [];
  const stats: PoeStat[] = [];

  for (const group of groups) {
    const entries = Array.isArray(group.entries) ? group.entries : [];
    for (const entry of entries) {
      if (typeof entry.id === 'string' && typeof entry.text === 'string' && typeof entry.type === 'string') {
        stats.push({ id: entry.id, text: entry.text, type: entry.type });
      }
    }
  }

  return stats;
}

export async function getAllStats(): Promise<PoeStat[]> {
  const now = Date.now();
  if (cachedStats.length > 0 && now - cacheTime < CACHE_TTL_MS) {
    return cachedStats;
  }

  try {
    cachedStats = await fetchStatsFromApi();
    cacheTime = Date.now();
    return cachedStats;
  } catch (err: unknown) {
    console.error('[poe-static-data] Failed to fetch stats, using fallback:', err instanceof Error ? err.message : err);
    if (cachedStats.length > 0) return cachedStats;
    return FALLBACK_STATS;
  }
}

export async function searchStats(query: string, limit = 50): Promise<PoeStat[]> {
  const stats = await getAllStats();
  const lowerQuery = query.toLowerCase();

  return stats
    .filter((stat) => stat.text.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}

export async function findStatByText(modText: string): Promise<PoeStat | undefined> {
  const stats = await getAllStats();
  // Clean numeric ranges: replace actual numbers with # placeholder
  const cleaned = modText.replace(/\d+(\.\d+)?/g, '#').trim();

  return stats.find((stat) => stat.text === cleaned)
    ?? stats.find((stat) => stat.text.toLowerCase() === cleaned.toLowerCase());
}

export async function findStatId(regexPattern: string): Promise<string | undefined> {
  const stats = await getAllStats();

  try {
    // Replace # placeholders with a sample number pattern for matching
    const testPattern = regexPattern.replace(/#/g, '10');
    const regex = new RegExp(testPattern, 'i');

    for (const stat of stats) {
      // Replace # in stat text with sample numbers for regex testing
      const sampleText = stat.text.replace(/#/g, '10');
      if (regex.test(sampleText)) {
        return stat.id;
      }
    }
  } catch {
    // If regex is invalid, try simple text matching
    const simplified = regexPattern.replace(/[\\^$.*+?()[\]{}|]/g, '').trim();
    if (simplified.length > 3) {
      const match = stats.find((stat) =>
        stat.text.toLowerCase().includes(simplified.toLowerCase()),
      );
      return match?.id;
    }
  }

  return undefined;
}

export type { PoeStat };
