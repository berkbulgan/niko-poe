// ABOUTME: Tests for community tag normalizing.
// ABOUTME: Pure function, no mocks.

import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTags } from './tags';

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

describe('tag rule (server: 1-24 chars of a-z, 0-9, space or dash)', () => {
  it('drops tags that are too long or have other characters', () => {
    const max = 'x'.repeat(24);
    expect(normalizeTags([max, 'x'.repeat(25), 'a_b', 'deli!', 'élite', 'big bossing', 't-17'])).toEqual([max, 'big bossing', 't-17']);
  });

  it('counts the 5 kept tags after dropping invalid ones', () => {
    expect(normalizeTags(['a?', 'a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('isValidTag checks a normalized tag', () => {
    expect(isValidTag('delirium')).toBe(true);
    expect(isValidTag('')).toBe(false);
    expect(isValidTag('a.b')).toBe(false);
    expect(isValidTag('Delirium')).toBe(false);
  });
});
