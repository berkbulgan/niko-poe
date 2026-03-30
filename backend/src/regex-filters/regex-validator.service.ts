// ABOUTME: Service for validating regex patterns and testing them against text.
// Also provides a catalog of known PoE 1 modifier patterns.

import { Injectable } from '@nestjs/common';

interface RegexValidationResult {
  valid: boolean;
  error: string | null;
}

interface RegexMatchResult {
  line: number;
  text: string;
  matches: string[];
}

interface KnownModifier {
  name: string;
  pattern: string;
  category: string;
}

@Injectable()
export class RegexValidatorService {
  validatePattern(pattern: string): RegexValidationResult {
    try {
      new RegExp(pattern);
      return { valid: true, error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid regex pattern';
      return { valid: false, error: message };
    }
  }

  testAgainstText(
    pattern: string,
    text: string,
  ): RegexMatchResult[] {
    const regex = new RegExp(pattern, 'g');
    const lines = text.split('\n');
    const results: RegexMatchResult[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      regex.lastIndex = 0;
      const lineMatches: string[] = [];
      let match = regex.exec(line);

      while (match !== null) {
        lineMatches.push(match[0]);
        if (!regex.global) break;
        match = regex.exec(line);
      }

      if (lineMatches.length > 0) {
        results.push({
          line: i + 1,
          text: line,
          matches: lineMatches,
        });
      }
    }

    return results;
  }

  getKnownMods(): KnownModifier[] {
    return [
      // Offensive
      { name: 'Flat Physical Damage', pattern: 'Adds \\d+ to \\d+ Physical Damage', category: 'offensive' },
      { name: 'Increased Physical Damage', pattern: '\\d+% increased Physical Damage', category: 'offensive' },
      { name: 'Attack Speed', pattern: '\\d+% increased Attack Speed', category: 'offensive' },
      { name: 'Critical Strike Chance', pattern: '\\d+% increased Critical Strike Chance', category: 'offensive' },
      { name: 'Critical Strike Multiplier', pattern: '\\+\\d+% to Critical Strike Multiplier', category: 'offensive' },
      { name: 'Flat Fire Damage', pattern: 'Adds \\d+ to \\d+ Fire Damage', category: 'offensive' },
      { name: 'Flat Cold Damage', pattern: 'Adds \\d+ to \\d+ Cold Damage', category: 'offensive' },
      { name: 'Flat Lightning Damage', pattern: 'Adds \\d+ to \\d+ Lightning Damage', category: 'offensive' },
      { name: 'Spell Damage', pattern: '\\d+% increased Spell Damage', category: 'offensive' },
      { name: 'Cast Speed', pattern: '\\d+% increased Cast Speed', category: 'offensive' },

      // Defensive
      { name: 'Maximum Life', pattern: '\\+\\d+ to maximum Life', category: 'defensive' },
      { name: 'Maximum Mana', pattern: '\\+\\d+ to maximum Mana', category: 'defensive' },
      { name: 'Maximum Energy Shield', pattern: '\\+\\d+ to maximum Energy Shield', category: 'defensive' },
      { name: 'Fire Resistance', pattern: '\\+\\d+% to Fire Resistance', category: 'defensive' },
      { name: 'Cold Resistance', pattern: '\\+\\d+% to Cold Resistance', category: 'defensive' },
      { name: 'Lightning Resistance', pattern: '\\+\\d+% to Lightning Resistance', category: 'defensive' },
      { name: 'Chaos Resistance', pattern: '\\+\\d+% to Chaos Resistance', category: 'defensive' },
      { name: 'All Elemental Resistances', pattern: '\\+\\d+% to all Elemental Resistances', category: 'defensive' },
      { name: 'Armour', pattern: '\\+\\d+ to Armour', category: 'defensive' },
      { name: 'Evasion Rating', pattern: '\\+\\d+ to Evasion Rating', category: 'defensive' },
      { name: 'Increased Armour', pattern: '\\d+% increased Armour', category: 'defensive' },
      { name: 'Increased Evasion', pattern: '\\d+% increased Evasion Rating', category: 'defensive' },
      { name: 'Life Regeneration', pattern: '\\d+\\.?\\d* Life Regenerated per second', category: 'defensive' },

      // Utility
      { name: 'Movement Speed', pattern: '\\d+% increased Movement Speed', category: 'utility' },
      { name: 'Item Quantity', pattern: '\\d+% increased Quantity of Items found', category: 'utility' },
      { name: 'Item Rarity', pattern: '\\d+% increased Rarity of Items found', category: 'utility' },
      { name: 'Strength', pattern: '\\+\\d+ to Strength', category: 'utility' },
      { name: 'Dexterity', pattern: '\\+\\d+ to Dexterity', category: 'utility' },
      { name: 'Intelligence', pattern: '\\+\\d+ to Intelligence', category: 'utility' },
      { name: 'All Attributes', pattern: '\\+\\d+ to all Attributes', category: 'utility' },
    ];
  }
}
