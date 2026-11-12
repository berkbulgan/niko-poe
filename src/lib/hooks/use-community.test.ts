// ABOUTME: Tests for isGone, which tells a deleted community strategy apart from other failures.
// ABOUTME: Pure check on the error message; ipc is mocked so no Tauri runtime is needed.

import { describe, expect, it, vi } from 'vitest';
import { isGone } from './use-community';

vi.mock('@/lib/ipc', () => ({}));

describe('isGone', () => {
  it('is true for a not-found error from the server', () => {
    expect(isGone(new Error('strategy not found'))).toBe(true);
  });

  it('is false for other errors and non-errors', () => {
    expect(isGone(new Error('connection refused'))).toBe(false);
    expect(isGone('strategy not found')).toBe(false);
    expect(isGone(null)).toBe(false);
  });
});
