// ABOUTME: Type definitions for strategies, strategy items, and price categories.
// ABOUTME: Shared between hooks, stores, and UI components for the Strategies feature.

export type PriceCategory =
  | 'scarab'
  | 'deliriumOrb'
  | 'currency'
  | 'chisel'
  | 'astrolabe';

export interface StrategyItem {
  itemId: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  icon: string;
  mapsPerUse?: number;
}

export interface StrategyConfig {
  items: StrategyItem[];
  averageMapCost: number;
  mapCount: number;
  filterPresetId: string | null;
  atlasTreeId: string | null;
}

export interface SelectedItem {
  itemId: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  icon: string;
  mapsPerUse: number;
}
