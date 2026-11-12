// ABOUTME: Tests the confirm store that backs the app's AlertDialog confirmations.
// ABOUTME: Covers settling, superseding a pending request, and confirmDiscard's no-prompt path.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeText: vi.fn() }));

const { confirm, settle, useConfirmStore } = await import('./confirm-store');
const { confirmDiscard } = await import('@/lib/platform');

beforeEach(() => settle(false));

describe('confirm store', () => {
  it('resolves true on settle(true) and clears the request', async () => {
    const answer = confirm({ title: 'Delete?' });
    expect(useConfirmStore.getState().request?.title).toBe('Delete?');
    settle(true);
    await expect(answer).resolves.toBe(true);
    expect(useConfirmStore.getState().request).toBeNull();
  });

  it('resolves false on settle(false)', async () => {
    const answer = confirm({ title: 'Delete?' });
    settle(false);
    await expect(answer).resolves.toBe(false);
  });

  it('resolves a superseded request as false', async () => {
    const first = confirm({ title: 'First' });
    const second = confirm({ title: 'Second' });
    await expect(first).resolves.toBe(false);
    expect(useConfirmStore.getState().request?.title).toBe('Second');
    settle(true);
    await expect(second).resolves.toBe(true);
  });
});

describe('confirmDiscard', () => {
  it('resolves true without asking when nothing is unsaved', async () => {
    await expect(confirmDiscard(false)).resolves.toBe(true);
    expect(useConfirmStore.getState().request).toBeNull();
  });

  it('asks with the discard wording when something is unsaved', async () => {
    const answer = confirmDiscard(true);
    expect(useConfirmStore.getState().request).toMatchObject({
      title: 'You have unsaved changes. Discard them?',
      confirmLabel: 'Discard',
      destructive: true,
    });
    settle(false);
    await expect(answer).resolves.toBe(false);
  });
});
