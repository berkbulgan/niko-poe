// ABOUTME: Normalizes community strategy tags before publishing.
// ABOUTME: Trimmed, lowercased, valid per the server rule, unique, at most MAX_TAGS.

export const MAX_TAGS = 5;

/** The community server's rule (validate() in community-api). */
export const TAG_RULE = 'Tags are 1-24 characters of a-z, 0-9, space or dash';

/** Whether an already trimmed and lowercased tag passes the server's check. */
export function isValidTag(tag: string): boolean {
  return /^[a-z0-9 -]{1,24}$/.test(tag);
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(isValidTag))].slice(0, MAX_TAGS);
}
