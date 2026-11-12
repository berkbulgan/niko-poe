// ABOUTME: Guards that package-lock.json holds exactly one copy of the Radix internals that keep global stacks.
// ABOUTME: Duplicate focus-scope or dismissable-layer copies break nested layers (Select inside Dialog).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, unknown> };

describe('radix dedupe', () => {
  for (const name of ['react-focus-scope', 'react-dismissable-layer']) {
    it(`has a single copy of @radix-ui/${name}`, () => {
      const suffix = `node_modules/@radix-ui/${name}`;
      const copies = Object.keys(lock.packages).filter((k) => k.endsWith(suffix));
      expect(copies).toHaveLength(1);
    });
  }
});
