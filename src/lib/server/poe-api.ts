// ABOUTME: PoE Trade API client with rate limiting — proxies search and fetch requests to pathofexile.com.
// ABOUTME: Enforces 1.5s delay between requests to respect GGG rate limits.

const BASE_URL = process.env.POE_TRADE_API_URL ?? 'https://www.pathofexile.com/api/trade';
const DEFAULT_LEAGUE = process.env.POE_LEAGUE ?? 'Settlers';
const USER_AGENT = 'CADIRO-TradeHelper/0.1.0';
const RATE_LIMIT_MS = 1500;

let lastRequestTime = 0;

interface League {
  id: string;
  text: string;
  realm?: string;
}

interface TradeStatFilter {
  id: string;
  disabled: boolean;
}

interface TradeStatGroup {
  type: string;
  filters: TradeStatFilter[];
}

interface TradeQuery {
  query: {
    status: { option: string };
    stats: TradeStatGroup[];
    filters?: Record<string, unknown>;
  };
  sort: { price: string };
}

interface TradeSearchResponse {
  id: string;
  total: number;
  result: string[];
}

interface TradeResult {
  id: string;
  listing: Record<string, unknown>;
  item: Record<string, unknown>;
}

interface TradeFetchResponse {
  result: TradeResult[];
}

interface LeagueApiEntry {
  id?: string;
  text?: string;
  realm?: string;
}

interface LeagueApiResponse {
  result?: LeagueApiEntry[];
}

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

export async function fetchLeagues(): Promise<League[]> {
  const url = `${BASE_URL}/../data/leagues`;
  const res = await rateLimitedFetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch leagues: ${res.status}`);
  }

  const data = (await res.json()) as LeagueApiResponse;
  const entries = Array.isArray(data.result) ? data.result : [];

  return entries
    .filter((entry): entry is LeagueApiEntry & { id: string; text: string } =>
      typeof entry.id === 'string' &&
      typeof entry.text === 'string' &&
      (entry.realm === 'pc' || entry.realm === undefined),
    )
    .map(({ id, text, realm }) => ({ id, text, realm }));
}

export async function searchTrade(
  query: TradeQuery,
  league?: string,
): Promise<{ id: string; total: number; result: string[] }> {
  const leagueName = league ?? DEFAULT_LEAGUE;
  const url = `${BASE_URL}/search/${encodeURIComponent(leagueName)}`;
  const res = await rateLimitedFetch(url, {
    method: 'POST',
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`Trade search failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TradeSearchResponse;
  return { id: data.id, total: data.total, result: data.result ?? [] };
}

export async function fetchResults(
  queryId: string,
  resultIds: string[],
): Promise<TradeResult[]> {
  if (resultIds.length === 0) return [];

  const ids = resultIds.slice(0, 10).join(',');
  const url = `${BASE_URL}/fetch/${ids}?query=${encodeURIComponent(queryId)}`;
  const res = await rateLimitedFetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch results: ${res.status}`);
  }

  const data = (await res.json()) as TradeFetchResponse;
  return data.result ?? [];
}

export function buildQuery(
  statIds: string[],
  options?: { minPrice?: number; maxPrice?: number; currency?: string },
): TradeQuery {
  const filters: TradeStatFilter[] = statIds.map((id) => ({
    id,
    disabled: false,
  }));

  const query: TradeQuery = {
    query: {
      status: { option: 'online' },
      stats: [{ type: 'and', filters }],
    },
    sort: { price: 'asc' },
  };

  if (options?.minPrice !== undefined || options?.maxPrice !== undefined || options?.currency) {
    query.query.filters = {
      trade_filters: {
        filters: {
          ...(options.minPrice !== undefined || options.maxPrice !== undefined
            ? {
                price: {
                  ...(options.minPrice !== undefined ? { min: options.minPrice } : {}),
                  ...(options.maxPrice !== undefined ? { max: options.maxPrice } : {}),
                  ...(options.currency ? { option: options.currency } : {}),
                },
              }
            : {}),
        },
      },
    };
  }

  return query;
}

export type { League, TradeQuery, TradeResult, TradeStatFilter, TradeStatGroup };
