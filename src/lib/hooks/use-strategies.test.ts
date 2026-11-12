// ABOUTME: Tests for deleting a strategy, which first removes its community copy.
// ABOUTME: ipc and community-storage are mocked.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ipc from '@/lib/ipc';
import { getPublished, setPublished } from '@/lib/community-storage';
import { deleteStrategy } from './use-strategies';

vi.mock('@/lib/ipc', () => ({ deleteStrategy: vi.fn(), communityDelete: vi.fn() }));
vi.mock('@/lib/community-storage', () => ({ getPublished: vi.fn(), setPublished: vi.fn(), setFavourited: vi.fn() }));

const RECORD = { communityId: 'c1', token: 't1', hash: 'h' };

describe('deleteStrategy', () => {
  beforeEach(() => vi.resetAllMocks());

  it('deletes an unpublished strategy without calling the server', async () => {
    vi.mocked(getPublished).mockReturnValue(null);
    await deleteStrategy('s1');
    expect(ipc.communityDelete).not.toHaveBeenCalled();
    expect(ipc.deleteStrategy).toHaveBeenCalledWith('s1');
  });

  it('unpublishes first, then deletes', async () => {
    vi.mocked(getPublished).mockReturnValue(RECORD);
    await deleteStrategy('s1');
    expect(ipc.communityDelete).toHaveBeenCalledWith('c1', 't1');
    expect(setPublished).toHaveBeenCalledWith('s1', null);
    expect(ipc.deleteStrategy).toHaveBeenCalledWith('s1');
  });

  it('still deletes when the community copy is already gone', async () => {
    vi.mocked(getPublished).mockReturnValue(RECORD);
    vi.mocked(ipc.communityDelete).mockRejectedValue(new Error('strategy not found'));
    await deleteStrategy('s1');
    expect(setPublished).toHaveBeenCalledWith('s1', null);
    expect(ipc.deleteStrategy).toHaveBeenCalledWith('s1');
  });

  it('keeps the strategy when unpublishing fails', async () => {
    vi.mocked(getPublished).mockReturnValue(RECORD);
    vi.mocked(ipc.communityDelete).mockRejectedValue(new Error('network down'));
    await expect(deleteStrategy('s1')).rejects.toThrow(/network down/);
    expect(setPublished).not.toHaveBeenCalled();
    expect(ipc.deleteStrategy).not.toHaveBeenCalled();
  });
});
