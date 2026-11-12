// ABOUTME: Tests for community tag normalizing.
// ABOUTME: Pure function, no mocks.

import { describe, expect, it } from 'vitest';
import { normalizeTags } from './tags';

describe('normalizeTags', () => {
  it('trims, lowercases and drops empty values', () => {
    expect(normalizeTags([' Delirium ', '', '   ', 'BREACH'])).toEqual(['delirium', 'breach']);
  });

  it('drops duplicates, keeping the first', () => {
    expect(normalizeTags(['breach', 'Delirium', 'BREACH', 'delirium '])).toEqual(['breach', 'delirium']);
  });

  it('keeps at most 5 tags, counted after removing duplicates', () => {
    expect(normalizeTags(['a', 'A', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
