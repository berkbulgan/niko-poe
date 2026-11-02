// ABOUTME: Tests for strategy cost per map (used by snapshot ROI).
// ABOUTME: Astrolabes cover 5 maps each and the average map cost is added per map.

import { describe, expect, it } from 'vitest';
import { strategyCostPerMap } from './strategy-cost';

describe('strategyCostPerMap', () => {
  it('spreads multi-map items and adds the average map cost', () => {
    const cost = strategyCostPerMap({
      items: [
        { itemId: 0, name: 'Divination Scarab', category: 'scarab', quantity: 2, unitPrice: 3, icon: '' },
        { itemId: 0, name: 'Grand Astrolabe', category: 'astrolabe', quantity: 1, unitPrice: 50, icon: '' },
      ],
      averageMapCost: 4,
      mapCount: 100,
      filterPresetId: null,
      atlasTreeId: null,
    });
    expect(cost).toBe(2 * 3 + 50 / 5 + 4);
  });
});
