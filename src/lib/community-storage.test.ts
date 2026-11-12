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

describe('getPublishedIds / getFavouriteIds', () => {
  it('lists the community ids this install published or favourited', () => {
    expect(lib.getPublishedIds()).toEqual([]);
    expect(lib.getFavouriteIds()).toEqual([]);
    lib.setPublished('s1', { communityId: 'aaaaaaaa', token: 't1' });
    lib.setPublished('s2', { communityId: 'bbbbbbbb', token: 't2' });
    lib.setFavourited('cccccccc', true);
    expect(lib.getPublishedIds()).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    expect(lib.getFavouriteIds()).toEqual(['cccccccc']);
  });
});

describe('importedStrategyId', () => {
  it('returns the first local strategy linked to the community id', () => {
    lib.setLinked('s1', { communityId: 'aaaaaaaa', hash: 'h1' });
    lib.setLinked('s2', { communityId: 'aaaaaaaa', hash: 'h2' });
    expect(lib.importedStrategyId('aaaaaaaa', [{ id: 's0' }, { id: 's2' }, { id: 's1' }])).toBe('s2');
  });

  it('returns null when no local strategy is linked to it', () => {
    lib.setLinked('s1', { communityId: 'aaaaaaaa', hash: 'h1' });
    expect(lib.importedStrategyId('bbbbbbbb', [{ id: 's1' }])).toBeNull();
  });

  it('ignores links whose local strategy was deleted', () => {
    lib.setLinked('gone', { communityId: 'aaaaaaaa', hash: 'h1' });
    expect(lib.importedStrategyId('aaaaaaaa', [{ id: 's1' }])).toBeNull();
  });
});

describe('publishState', () => {
  it('is none without a record', () => {
    expect(lib.publishState(null, 'h')).toBe('none');
  });

  it('is published when the record has no hash or the saved hash is unknown', () => {
    expect(lib.publishState({ communityId: 'aaaaaaaa', token: 't' }, 'h')).toBe('published');
    expect(lib.publishState({ communityId: 'aaaaaaaa', token: 't', hash: 'h' }, null)).toBe('published');
  });

  it('is published when the hashes match and stale when they differ', () => {
    expect(lib.publishState({ communityId: 'aaaaaaaa', token: 't', hash: 'h' }, 'h')).toBe('published');
    expect(lib.publishState({ communityId: 'aaaaaaaa', token: 't', hash: 'h' }, 'other')).toBe('stale');
  });
});
