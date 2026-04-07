// ABOUTME: Regex optimization engine ported from poe-vendor-string's OptimizeRegexResult.ts.
// ABOUTME: Uses precomputed optimization table to find shorter regex for mod combinations.

import { MAP_MODS, OPTIMIZATION_TABLE, type MapMod } from '@/data';

function distinct(arr: string[]): string[] {
  return [...new Set(arr)];
}

function optimizationSize(numberOfElements: number): number {
  if (numberOfElements < 15) return 8;
  if (numberOfElements < 18) return 7;
  if (numberOfElements < 21) return 6;
  if (numberOfElements < 28) return 5;
  return 4;
}

function generateOptimizationKeys(arr: number[], maxLength: number): string[] {
  const result: string[] = [];
  const minLength = 2;

  function combine(start: number, combination: number[]) {
    if (combination.length >= minLength && combination.length <= maxLength) {
      result.push(combination.join(':'));
    }
    for (let i = start; i < arr.length; i++) {
      if (combination.length < maxLength) {
        combine(i + 1, [...combination, arr[i]]);
      }
    }
  }

  combine(0, []);
  // Longest combinations first — greedily pick the biggest savings
  return result.sort((a, b) => b.length - a.length);
}

export function idToRegex(id: number): string | undefined {
  return MAP_MODS.find((token) => id === token.id)?.regex;
}

export function optimizeRegexFromIds(selectedIds: number[]): string[] {
  const validTokenIds = new Set(MAP_MODS.map((t) => t.id));
  const existingIds = selectedIds.filter((id) => validTokenIds.has(id));

  if (existingIds.length === 0) return [];

  const maxLength = optimizationSize(existingIds.length);
  const optimizationKeys = generateOptimizationKeys(existingIds, maxLength);

  const optimizedRegex: string[] = [];
  let remainingIds = [...existingIds];

  for (const key of optimizationKeys) {
    const optimizationResult = OPTIMIZATION_TABLE[key];
    if (optimizationResult === undefined) continue;
    if (!optimizationResult.ids.every((id) => remainingIds.includes(id))) continue;

    optimizedRegex.push(optimizationResult.regex);
    const idsToRemove = new Set(optimizationResult.ids);
    remainingIds = remainingIds.filter((id) => !idsToRemove.has(id));
  }

  // Remaining unoptimized IDs use individual regex
  const unoptimizedRegex = remainingIds
    .map((id) => idToRegex(id))
    .filter((r): r is string => r !== undefined);

  return distinct([...optimizedRegex, ...unoptimizedRegex]);
}

export function buildOptimizedVendorRegex(
  avoidMods: MapMod[],
  preferMods: MapMod[],
  statParts: string[],
): string {
  const parts: string[] = [];

  if (avoidMods.length > 0) {
    const avoidRegex = optimizeRegexFromIds(avoidMods.map((m) => m.id));
    parts.push(`"!${avoidRegex.join('|')}"`);
  }

  if (preferMods.length > 0) {
    const preferRegex = optimizeRegexFromIds(preferMods.map((m) => m.id));
    parts.push(`"${preferRegex.join('|')}"`);
  }

  // Append stat filter parts (quantity, packsize, etc.)
  parts.push(...statParts);

  return parts.join(' ');
}
