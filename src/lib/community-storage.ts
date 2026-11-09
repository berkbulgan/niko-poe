// ABOUTME: Local records for community features: edit tokens of published strategies, favourites, server override.
// ABOUTME: Everything goes through platform.storage; only the install id is ever sent, with shared results.

import { storage } from '@/lib/platform';

const PUBLISHED_KEY = 'niko_community_published';
const FAVOURITES_KEY = 'niko_community_favourites';
const SERVER_URL_KEY = 'niko_community_url';
const LINKED_KEY = 'niko_community_linked';
const INSTALL_ID_KEY = 'niko_install_id';

export interface PublishedRecord {
  communityId: string;
  token: string;
  /** Content hash of the strategy config when last published; missing on records from before 0.7.0. */
  hash?: string;
}

/** A local strategy imported from the community, with the content hash it had right after import. */
export interface LinkedRecord {
  communityId: string;
  hash: string;
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

export function getLinked(strategyId: string): LinkedRecord | null {
  return readJson<Record<string, LinkedRecord>>(LINKED_KEY, {})[strategyId] ?? null;
}

export function setLinked(strategyId: string, record: LinkedRecord | null): void {
  const all = readJson<Record<string, LinkedRecord>>(LINKED_KEY, {});
  if (record) all[strategyId] = record;
  else delete all[strategyId];
  storage.set(LINKED_KEY, JSON.stringify(all));
}

/** The community strategy this local one still matches, or null once its config was edited. */
export function linkedCommunityId(strategyId: string, currentHash: string): string | null {
  const published = getPublished(strategyId);
  if (published?.hash === currentHash) return published.communityId;
  const linked = getLinked(strategyId);
  return linked?.hash === currentHash ? linked.communityId : null;
}

/** Random per-install id, created on first use; the server only keeps a salted hash of it. */
export function getInstallId(): string {
  const existing = storage.get(INSTALL_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  storage.set(INSTALL_ID_KEY, id);
  return id;
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
