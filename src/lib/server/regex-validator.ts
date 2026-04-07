// ABOUTME: Regex pattern validation and testing against sample text.
// ABOUTME: Provides known PoE modifier catalog for quick filter creation.

interface ValidationResult {
  valid: boolean;
  error: string | null;
}

interface RegexMatchResult {
  line: number;
  text: string;
  matches: string[];
}

interface TestResult {
  valid: boolean;
  error: string | null;
  matches: RegexMatchResult[];
}

interface KnownMod {
  name: string;
  pattern: string;
  category: string;
}

export function validatePattern(pattern: string): ValidationResult {
  try {
    new RegExp(pattern);
    return { valid: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid regex pattern';
    return { valid: false, error: message };
  }
}

export function testAgainstText(pattern: string, text: string): TestResult {
  const validation = validatePattern(pattern);
  if (!validation.valid) {
    return { valid: false, error: validation.error, matches: [] };
  }

  const regex = new RegExp(pattern, 'gi');
  const lines = text.split('\n');
  const matches: RegexMatchResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const lineMatches: string[] = [];
    let match: RegExpExecArray | null;

    // Reset lastIndex for each line since we reuse the regex
    regex.lastIndex = 0;
    match = regex.exec(lineText);

    while (match !== null) {
      lineMatches.push(match[0]);
      // Prevent infinite loops on zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      match = regex.exec(lineText);
    }

    if (lineMatches.length > 0) {
      matches.push({ line: i + 1, text: lineText, matches: lineMatches });
    }
  }

  return { valid: true, error: null, matches };
}

export function getKnownMods(): KnownMod[] {
  return [
    // Offensive
    { name: 'Adds Flat Physical Damage', pattern: 'adds \\d+ to \\d+ physical damage', category: 'offensive' },
    { name: 'Adds Flat Fire Damage', pattern: 'adds \\d+ to \\d+ fire damage', category: 'offensive' },
    { name: 'Adds Flat Cold Damage', pattern: 'adds \\d+ to \\d+ cold damage', category: 'offensive' },
    { name: 'Adds Flat Lightning Damage', pattern: 'adds \\d+ to \\d+ lightning damage', category: 'offensive' },
    { name: 'Adds Flat Chaos Damage', pattern: 'adds \\d+ to \\d+ chaos damage', category: 'offensive' },
    { name: 'Increased Attack Speed', pattern: '\\d+% increased attack speed', category: 'offensive' },
    { name: 'Increased Cast Speed', pattern: '\\d+% increased cast speed', category: 'offensive' },
    { name: 'Critical Strike Chance', pattern: '\\d+% increased critical strike chance', category: 'offensive' },
    { name: 'Critical Strike Multiplier', pattern: '\\+?\\d+% to critical strike multiplier', category: 'offensive' },
    { name: 'Increased Spell Damage', pattern: '\\d+% increased spell damage', category: 'offensive' },

    // Defensive
    { name: 'Maximum Life', pattern: '\\+\\d+ to maximum life', category: 'defensive' },
    { name: 'Maximum Mana', pattern: '\\+\\d+ to maximum mana', category: 'defensive' },
    { name: 'Maximum Energy Shield', pattern: '\\+\\d+ to maximum energy shield', category: 'defensive' },
    { name: 'Fire Resistance', pattern: '\\+\\d+% to fire resistance', category: 'defensive' },
    { name: 'Cold Resistance', pattern: '\\+\\d+% to cold resistance', category: 'defensive' },
    { name: 'Lightning Resistance', pattern: '\\+\\d+% to lightning resistance', category: 'defensive' },
    { name: 'Chaos Resistance', pattern: '\\+\\d+% to chaos resistance', category: 'defensive' },
    { name: 'Increased Armour', pattern: '\\d+% increased armour', category: 'defensive' },
    { name: 'Increased Evasion Rating', pattern: '\\d+% increased evasion rating', category: 'defensive' },

    // Utility
    { name: 'Movement Speed', pattern: '\\d+% increased movement speed', category: 'utility' },
    { name: 'Item Quantity', pattern: '\\d+% increased quantity of items found', category: 'utility' },
    { name: 'Item Rarity', pattern: '\\d+% increased rarity of items found', category: 'utility' },
    { name: 'Strength', pattern: '\\+\\d+ to strength', category: 'utility' },
    { name: 'Dexterity', pattern: '\\+\\d+ to dexterity', category: 'utility' },
    { name: 'Intelligence', pattern: '\\+\\d+ to intelligence', category: 'utility' },
  ];
}
