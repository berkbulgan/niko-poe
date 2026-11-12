// ABOUTME: Ordering helper for the Avoid/Prefer mod columns on the Regex Filters page.
// ABOUTME: Lifts selected mods to the top while keeping each group's incoming (scary) order.

export function selectedFirst<T extends { id: number }>(mods: T[], selected: Set<number>): T[] {
  return [...mods.filter((m) => selected.has(m.id)), ...mods.filter((m) => !selected.has(m.id))];
}
