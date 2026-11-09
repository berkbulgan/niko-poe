// ABOUTME: Tests for community local storage helpers and community id detection.
// ABOUTME: platform.storage is replaced with an in-memory map.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@/lib/platform', () => ({
  storage: {
    get: (k: string) => store.get(k) ?? null,
    set: (k: string, v: string) => { store.set(k, v); },
    remove: (k: string) => { store.delete(k); },
  },
}));

const lib = await import('./community-storage');

beforeEach(() => store.clear());

describe('isCommunityId', () => {
  it('accepts 8 alphanumerics only', () => {
    expect(lib.isCommunityId('aZ09bC12')).toBe(true);
    expect(lib.isCommunityId(' aZ09bC12 ')).toBe(true);
    expect(lib.isCommunityId('aZ09bC1')).toBe(false);
    expect(lib.isCommunityId('S' + 'a'.repeat(40))).toBe(false);
    expect(lib.isCommunityId('aZ09-C12')).toBe(false);
  });
});

describe('published records', () => {
  it('stores, finds by community id and removes', () => {
    lib.setPublished('local-1', { communityId: 'abcdEFGH', token: 'tok' });
    expect(lib.getPublished('local-1')).toEqual({ communityId: 'abcdEFGH', token: 'tok' });
    expect(lib.getTokenForCommunityId('abcdEFGH')).toBe('tok');
    lib.setPublished('local-1', null);
    expect(lib.getPublished('local-1')).toBeNull();
    expect(lib.getTokenForCommunityId('abcdEFGH')).toBeNull();
  });

  it('survives corrupted storage', () => {
    store.set('niko_community_published', '{not json');
    expect(lib.getPublished('x')).toBeNull();
  });
});

describe('favourites', () => {
  it('toggles without duplicates', () => {
    lib.setFavourited('abcdEFGH', true);
    lib.setFavourited('abcdEFGH', true);
    expect(lib.isFavourited('abcdEFGH')).toBe(true);
    expect(JSON.parse(store.get('niko_community_favourites')!)).toEqual(['abcdEFGH']);
    lib.setFavourited('abcdEFGH', false);
    expect(lib.isFavourited('abcdEFGH')).toBe(false);
  });
});

describe('linkedCommunityId', () => {
  it('uses a published record whose hash matches', () => {
    lib.setPublished('s1', { communityId: 'aZ09bC12', token: 't', hash: 'h1' });
    expect(lib.linkedCommunityId('s1', 'h1')).toBe('aZ09bC12');
    expect(lib.linkedCommunityId('s1', 'changed')).toBeNull();
  });

  it('uses an import link whose hash matches', () => {
    lib.setLinked('s2', { communityId: 'bbbbbbbb', hash: 'h2' });
    expect(lib.linkedCommunityId('s2', 'h2')).toBe('bbbbbbbb');
    expect(lib.linkedCommunityId('s2', 'other')).toBeNull();
    lib.setLinked('s2', null);
    expect(lib.linkedCommunityId('s2', 'h2')).toBeNull();
  });

  it('treats published records without a hash as unlinked', () => {
    lib.setPublished('s3', { communityId: 'cccccccc', token: 't' });
    expect(lib.linkedCommunityId('s3', 'anything')).toBeNull();
  });

  it('returns null without any record', () => {
    expect(lib.linkedCommunityId('nope', 'h')).toBeNull();
  });
});

describe('getInstallId', () => {
  it('creates the id once and reuses it', () => {
    const id = lib.getInstallId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(lib.getInstallId()).toBe(id);
  });
});
