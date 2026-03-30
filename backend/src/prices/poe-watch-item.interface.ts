// ABOUTME: Interface for items returned by the poe.watch price API.
// ABOUTME: Used by PriceCacheService to type API responses and cache entries.

export interface PoeWatchItem {
  id: number;
  name: string;
  category: string;
  mean: number;
  daily: number;
  change: number;
  lowConfidence: boolean;
  icon: string;
}
