// ABOUTME: Normalizes community strategy tags before publishing.
// ABOUTME: Trimmed, lowercased, unique, at most MAX_TAGS.

export const MAX_TAGS = 5;

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_TAGS);
}
