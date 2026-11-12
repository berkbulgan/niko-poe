// ABOUTME: TypeScript mirror of the niko-community-api crate (src-tauri/community-api).
// ABOUTME: Field names match the Rust serde camelCase output 1:1.

export type Budget = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type CommunitySort = 'new' | 'favourites' | 'profit';

/** Medians over measured results in the strategy's league; null below 3 results. */
export interface StrategyStats {
  runs: number;
  players: number;
  medianDivPerHour: number;
  medianMapsPerHour: number;
  medianProfitPerMap: number;
}

export interface PublishRequest {
  name: string;
  authorName: string | null;
  league: string;
  patch: string | null;
  tags: string[];
  budget: Budget;
  difficulty: Difficulty;
  notes: string;
  videoUrl: string | null;
  shareCode: string;
}

export interface PublishResponse {
  id: string;
  editToken: string;
}

export interface StrategySummary {
  id: string;
  name: string;
  authorName: string | null;
  league: string;
  patch: string | null;
  tags: string[];
  budget: Budget;
  difficulty: Difficulty;
  videoUrl: string | null;
  favouriteCount: number;
  createdAt: string;
  updatedAt: string;
  stats: StrategyStats | null;
}

export interface StrategyDetail extends StrategySummary {
  notes: string;
  shareCode: string;
}

export interface ListQuery {
  q?: string;
  tag?: string;
  league?: string;
  budget?: Budget;
  difficulty?: Difficulty;
  sort: CommunitySort;
  page: number;
  limit: number;
}

export interface ListResponse {
  items: StrategySummary[];
  total: number;
}

export interface TagCount {
  tag: string;
  count: number;
}
