// ABOUTME: Type definitions for filter presets, map stat filters, and quality types.
// ABOUTME: Shared between hooks, stores, and UI components for the Filters feature.

export type QualityType = 'pack_size' | 'rarity' | 'currency' | 'scarabs' | 'cards';

export interface MapStatFilters {
  quantity: string;
  packSize: string;
  rarity: string;
  mapTier: string;
  quality: string;
  qualityType: QualityType;
  moreCurrency: string;
  moreMaps: string;
  moreScarabs: string;
  moreDivination: string;
  corrupted: 'natural' | 'prefer' | 'avoid';
}

export interface FilterPresetConfig {
  quantity: string;
  packSize: string;
  rarity: string;
  mapTier: string;
  quality: string;
  qualityType: string;
  moreCurrency: string;
  moreMaps: string;
  moreScarabs: string;
  moreDivination: string;
  corrupted: 'natural' | 'prefer' | 'avoid';
  isNightmareMap?: boolean;
  avoidModIds: number[];
  preferModIds: number[];
}
