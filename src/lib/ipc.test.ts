// ABOUTME: Tests for IPC error normalization in ipc.ts.
// ABOUTME: Rust commands reject with the serialized Error enum, which must surface as Error.message.

import { describe, expect, it } from 'vitest';
import { toError } from './ipc';

describe('toError', () => {
  it('unwraps the serialized Rust Error enum', () => {
    expect(toError({ Auth: 'GGG session expired — please log in again' }).message)
      .toBe('GGG session expired — please log in again');
  });

  it('keeps Error instances and wraps strings', () => {
    const err = new Error('boom');
    expect(toError(err)).toBe(err);
    expect(toError('plain').message).toBe('plain');
  });
});
