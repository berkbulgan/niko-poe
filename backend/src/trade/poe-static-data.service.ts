// ABOUTME: Static data service that fetches and caches PoE 1 stats from the official trade API.
// ABOUTME: Provides stat lookup, regex-to-statId matching, and currency value references.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TradeStatEntry {
  id: string;
  text: string;
  type: string;
  option?: {
    options: Array<{ id: number; text: string }>;
  };
}

export interface TradeStatCategory {
  id: string;
  label: string;
  entries: TradeStatEntry[];
}

export interface CurrencyValue {
  id: string;
  name: string;
  chaosEquivalent: number;
}

@Injectable()
export class PoeStaticDataService implements OnModuleInit {
  private readonly logger = new Logger(PoeStaticDataService.name);
  private readonly baseUrl: string;
  private categories: TradeStatCategory[] = [];
  private allStats: TradeStatEntry[] = [];
  private lastFetchTime = 0;
  private readonly cacheLifetime = 3600000; // 1 hour

  private readonly currencies: CurrencyValue[] = [
    { id: 'divine', name: 'Divine Orb', chaosEquivalent: 150 },
    { id: 'exalted', name: 'Exalted Orb', chaosEquivalent: 15 },
    { id: 'chaos', name: 'Chaos Orb', chaosEquivalent: 1 },
    { id: 'alchemy', name: 'Orb of Alchemy', chaosEquivalent: 0.5 },
    { id: 'fusing', name: 'Orb of Fusing', chaosEquivalent: 0.5 },
    { id: 'chromatic', name: 'Chromatic Orb', chaosEquivalent: 0.08 },
    { id: 'jeweller', name: "Jeweller's Orb", chaosEquivalent: 0.1 },
    { id: 'alteration', name: 'Orb of Alteration', chaosEquivalent: 0.07 },
    { id: 'chance', name: 'Orb of Chance', chaosEquivalent: 0.07 },
    { id: 'scouring', name: 'Orb of Scouring', chaosEquivalent: 0.3 },
    { id: 'regret', name: 'Orb of Regret', chaosEquivalent: 0.2 },
    { id: 'vaal', name: 'Vaal Orb', chaosEquivalent: 1 },
    { id: 'gcp', name: "Gemcutter's Prism", chaosEquivalent: 0.8 },
    { id: 'blessed', name: 'Blessed Orb', chaosEquivalent: 0.3 },
    { id: 'regal', name: 'Regal Orb', chaosEquivalent: 1 },
    { id: 'annulment', name: 'Orb of Annulment', chaosEquivalent: 5 },
    { id: 'ancient', name: 'Ancient Orb', chaosEquivalent: 10 },
  ];

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'POE_TRADE_API_URL',
      'https://www.pathofexile.com/api/trade',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.fetchStats();
  }

  async fetchStats(): Promise<void> {
    const now = Date.now();
    if (this.allStats.length > 0 && now - this.lastFetchTime < this.cacheLifetime) {
      return;
    }

    try {
      this.logger.log('Fetching stats from PoE Trade API...');
      const url = `${this.baseUrl}/data/stats`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CADIRO-TradeHelper/0.1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Trade API returned ${response.status}`);
      }

      const data = (await response.json()) as { result: TradeStatCategory[] };
      this.categories = data.result;
      this.allStats = data.result.flatMap((cat) =>
        cat.entries.map((entry) => ({
          ...entry,
          type: entry.type ?? cat.id,
        })),
      );

      this.lastFetchTime = now;
      this.logger.log(
        `Loaded ${this.allStats.length} stats across ${this.categories.length} categories: ${this.categories.map((c) => c.id).join(', ')}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Failed to fetch stats from API: ${message}. Using fallback data.`);

      if (this.allStats.length === 0) {
        this.loadFallbackStats();
      }
    }
  }

  getCategories(): TradeStatCategory[] {
    return this.categories;
  }

  getAllStats(): TradeStatEntry[] {
    return this.allStats;
  }

  getStatsByType(type: string): TradeStatEntry[] {
    return this.allStats.filter((s) => s.type === type);
  }

  searchStats(query: string, limit = 20): TradeStatEntry[] {
    const lower = query.toLowerCase();
    return this.allStats
      .filter((s) => s.text.toLowerCase().includes(lower))
      .slice(0, limit);
  }

  findStatByText(modText: string): string | null {
    // Clean up the mod text: remove numeric ranges like (20-60), replace with #
    const cleaned = modText
      .replace(/\(\d+-\d+\)/g, '#')
      .replace(/\d+/g, '#')
      .trim()
      .toLowerCase();

    // Direct match: stat text matches cleaned mod text
    for (const stat of this.allStats) {
      const statCleaned = stat.text.toLowerCase();
      if (statCleaned === cleaned) {
        return stat.id;
      }
    }

    // Fuzzy match: check if one contains the other
    for (const stat of this.allStats) {
      const statCleaned = stat.text.toLowerCase();
      if (statCleaned.includes(cleaned) || cleaned.includes(statCleaned)) {
        return stat.id;
      }
    }

    // Word-based match: check if key words overlap
    const keyWords = cleaned
      .replace(/#/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (keyWords.length >= 2) {
      for (const stat of this.allStats) {
        const statLower = stat.text.toLowerCase();
        const matchCount = keyWords.filter((w) => statLower.includes(w)).length;
        if (matchCount >= keyWords.length * 0.7) {
          return stat.id;
        }
      }
    }

    return null;
  }

  getCurrencyValues(): CurrencyValue[] {
    return this.currencies;
  }

  findStatId(regexPattern: string): string | null {
    // Strategy 1: Try matching regex against stat text (with # replaced by sample numbers)
    for (const stat of this.allStats) {
      try {
        const regex = new RegExp(regexPattern, 'i');
        const sampleText = stat.text
          .replace(/# to #/g, '10 to 20')
          .replace(/#/g, '50');

        if (regex.test(sampleText)) {
          return stat.id;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Strategy 2: Normalize both sides and do text matching
    const normalized = this.normalizeForComparison(regexPattern);
    if (normalized.length < 3) return null;

    for (const stat of this.allStats) {
      const statNormalized = this.normalizeForComparison(stat.text);
      if (statNormalized.includes(normalized) || normalized.includes(statNormalized)) {
        return stat.id;
      }
    }

    return null;
  }

  findStatsByRegexPatterns(patterns: string[]): Array<{ pattern: string; statId: string | null }> {
    return patterns.map((pattern) => ({
      pattern,
      statId: this.findStatId(pattern),
    }));
  }

  private normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .replace(/\\[+.()]/g, '') // remove regex escapes
      .replace(/\[[\d-]+\]/g, '') // remove character classes like [89]
      .replace(/\\d\+?/g, '#')
      .replace(/#+/g, '#')
      .replace(/[^a-z# ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private loadFallbackStats(): void {
    // Hardcoded subset for when API is unreachable
    const fallback: TradeStatEntry[] = [
      { id: 'explicit.stat_3299347043', text: '+# to maximum Life', type: 'explicit' },
      { id: 'explicit.stat_1050105434', text: '+# to maximum Mana', type: 'explicit' },
      { id: 'explicit.stat_4052037485', text: '+# to maximum Energy Shield', type: 'explicit' },
      { id: 'explicit.stat_3372524247', text: '+#% to Fire Resistance', type: 'explicit' },
      { id: 'explicit.stat_1671376347', text: '+#% to Cold Resistance', type: 'explicit' },
      { id: 'explicit.stat_1858141004', text: '+#% to Lightning Resistance', type: 'explicit' },
      { id: 'explicit.stat_2923486259', text: '+#% to Chaos Resistance', type: 'explicit' },
      { id: 'explicit.stat_2901986750', text: '+#% to all Elemental Resistances', type: 'explicit' },
      { id: 'explicit.stat_681332047', text: '#% increased Attack Speed', type: 'explicit' },
      { id: 'explicit.stat_587431675', text: '#% increased Critical Strike Chance', type: 'explicit' },
      { id: 'explicit.stat_3556824919', text: '+#% to Critical Strike Multiplier', type: 'explicit' },
      { id: 'explicit.stat_2250533757', text: '#% increased Movement Speed', type: 'explicit' },
      { id: 'explicit.stat_1509134228', text: '#% increased Physical Damage', type: 'explicit' },
      { id: 'explicit.stat_2974417149', text: '#% increased Spell Damage', type: 'explicit' },
      { id: 'explicit.stat_2891184298', text: '#% increased Cast Speed', type: 'explicit' },
      { id: 'explicit.stat_1573130764', text: 'Adds # to # Fire Damage', type: 'explicit' },
      { id: 'explicit.stat_1037193709', text: 'Adds # to # Cold Damage', type: 'explicit' },
      { id: 'explicit.stat_3336890334', text: 'Adds # to # Lightning Damage', type: 'explicit' },
      { id: 'explicit.stat_3299347043', text: '# to # Added Physical Damage', type: 'explicit' },
      { id: 'explicit.stat_809229260', text: '+# to Armour', type: 'explicit' },
      { id: 'explicit.stat_2144192055', text: '+# to Evasion Rating', type: 'explicit' },
      { id: 'explicit.stat_3484657501', text: '#% increased Armour', type: 'explicit' },
      { id: 'explicit.stat_2106365538', text: '#% increased Evasion Rating', type: 'explicit' },
      { id: 'explicit.stat_836936635', text: '# Life Regenerated per second', type: 'explicit' },
      { id: 'explicit.stat_4080418644', text: '+# to Strength', type: 'explicit' },
      { id: 'explicit.stat_3261801346', text: '+# to Dexterity', type: 'explicit' },
      { id: 'explicit.stat_328541901', text: '+# to Intelligence', type: 'explicit' },
      { id: 'explicit.stat_1379411836', text: '+# to all Attributes', type: 'explicit' },
      { id: 'explicit.stat_2523920708', text: '#% increased Quantity of Items found', type: 'explicit' },
      { id: 'explicit.stat_3917489142', text: '#% increased Rarity of Items found', type: 'explicit' },
      { id: 'pseudo.pseudo_total_life', text: '+# total maximum Life', type: 'pseudo' },
      { id: 'pseudo.pseudo_total_elemental_resistance', text: '+#% total Elemental Resistance', type: 'pseudo' },
      { id: 'pseudo.pseudo_total_resistance', text: '+#% total Resistance', type: 'pseudo' },
      { id: 'pseudo.pseudo_total_strength', text: '+# total to Strength', type: 'pseudo' },
      { id: 'pseudo.pseudo_total_dexterity', text: '+# total to Dexterity', type: 'pseudo' },
      { id: 'pseudo.pseudo_total_intelligence', text: '+# total to Intelligence', type: 'pseudo' },
    ];

    this.allStats = fallback;
    this.categories = [
      { id: 'explicit', label: 'Explicit', entries: fallback.filter((s) => s.type === 'explicit') },
      { id: 'pseudo', label: 'Pseudo', entries: fallback.filter((s) => s.type === 'pseudo') },
    ];

    this.logger.log(`Loaded ${fallback.length} fallback stats`);
  }
}
