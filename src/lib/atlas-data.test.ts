// ABOUTME: Tests refreshAtlasTag with the IPC layer mocked: which tag it picks and whether the server answered.
// ABOUTME: Covers a newer server tag, an unchanged tag, and an unreachable server keeping the saved pick.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasVersion } from '@/types/game-data';

vi.mock('@/lib/ipc', () => ({ atlasVersions: vi.fn(), atlasData: vi.fn() }));

const ipc = await import('@/lib/ipc');
const { BUNDLED_ATLAS, refreshAtlasTag } = await import('./atlas-data');
const { useGameDataStore } = await import('@/lib/stores/game-data-store');

const NEWER: AtlasVersion = { tag: '99.0.0', releasedAt: '2099-01-01T00:00:00Z' };
const files = { tag: NEWER.tag, dataJson: '{}', assetDir: 'x' };

describe('refreshAtlasTag', () => {
  beforeEach(() => {
    useGameDataStore.setState({ atlasTag: BUNDLED_ATLAS.tag, atlasVersions: [] });
    vi.mocked(ipc.atlasData).mockResolvedValue(files);
  });

  it('moves to a newer server tag', async () => {
    vi.mocked(ipc.atlasVersions).mockImplementation(async (refresh) => (refresh ? [NEWER, BUNDLED_ATLAS] : []));
    expect(await refreshAtlasTag()).toEqual({ newTag: '99.0.0', answered: true });
    expect(useGameDataStore.getState().atlasTag).toBe('99.0.0');
  });

  it('reports an answer without a new tag', async () => {
    vi.mocked(ipc.atlasVersions).mockResolvedValue([BUNDLED_ATLAS]);
    expect(await refreshAtlasTag()).toEqual({ newTag: null, answered: true });
  });

  it('keeps the saved pick when the server does not answer', async () => {
    vi.mocked(ipc.atlasVersions).mockImplementation(async (refresh) => {
      if (refresh) throw new Error('offline');
      return [NEWER, BUNDLED_ATLAS];
    });
    expect(await refreshAtlasTag()).toEqual({ newTag: '99.0.0', answered: false });
    expect(useGameDataStore.getState().atlasVersions).toEqual([NEWER, BUNDLED_ATLAS]);
  });
});
