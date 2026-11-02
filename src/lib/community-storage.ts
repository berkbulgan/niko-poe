// ABOUTME: Local records for community features: edit tokens of published strategies, favourites, server override.
// ABOUTME: Everything goes through platform.storage; nothing here is sent anywhere.

import { storage } from '@/lib/platform';

const PUBLISHED_KEY = 'niko_community_published';
const FAVOURITES_KEY = 'niko_community_favourites';
const SERVER_URL_KEY = 'niko_community_url';

export interface PublishedRecord {
  communityId: string;
  token: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Community ids are 8 ASCII alphanumerics; share codes are much longer. */
export function isCommunityId(input: string): boolean {
  return /^[0-9A-Za-z]{8}$/.test(input.trim());
}

/** Published records keyed by local strategy id. */
export function getPublished(strategyId: string): PublishedRecord | null {
  return readJson<Record<string, PublishedRecord>>(PUBLISHED_KEY, {})[strategyId] ?? null;
}

export function setPublished(strategyId: string, record: PublishedRecord | null): void {
  const all = readJson<Record<string, PublishedRecord>>(PUBLISHED_KEY, {});
  if (record) all[strategyId] = record;
  else delete all[strategyId];
  storage.set(PUBLISHED_KEY, JSON.stringify(all));
}

/** Edit token for a community id, if this install published it. */
export function getTokenForCommunityId(communityId: string): string | null {
  const all = readJson<Record<string, PublishedRecord>>(PUBLISHED_KEY, {});
  return Object.values(all).find((r) => r.communityId === communityId)?.token ?? null;
}

export function isFavourited(communityId: string): boolean {
  return readJson<string[]>(FAVOURITES_KEY, []).includes(communityId);
}

export function setFavourited(communityId: string, on: boolean): void {
  const ids = readJson<string[]>(FAVOURITES_KEY, []).filter((id) => id !== communityId);
  if (on) ids.push(communityId);
  storage.set(FAVOURITES_KEY, JSON.stringify(ids));
}

export function getServerUrlOverride(): string | null {
  return storage.get(SERVER_URL_KEY);
}

export function setServerUrlOverride(url: string | null): void {
  if (url) storage.set(SERVER_URL_KEY, url);
  else storage.remove(SERVER_URL_KEY);
}
