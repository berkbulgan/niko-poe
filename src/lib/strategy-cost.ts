// ABOUTME: Strategy cost math shared by the strategy builder and snapshot ROI.
// ABOUTME: Keeps "cost per map" identical everywhere a strategy's cost is shown.

import type { StrategyConfig } from '@/types/strategies';

// Categories where 1 unit covers multiple maps
export const MAPS_PER_USE: Partial<Record<string, number>> = {
  astrolabe: 5,
};

/** Chaos cost per map of a saved strategy: item costs (spread over maps per use) + average map cost. */
export function strategyCostPerMap(config: StrategyConfig): number {
  const itemsCost = config.items.reduce(
    (sum, item) =>
      sum + (item.quantity * item.unitPrice) / (MAPS_PER_USE[item.category] ?? item.mapsPerUse ?? 1),
    0,
  );
  return itemsCost + config.averageMapCost;
}
