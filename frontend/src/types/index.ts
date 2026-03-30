// ABOUTME: Shared TypeScript type definitions for the C.A.D.I.R.O. frontend.
// ABOUTME: Covers auth, regex filters, trade search, and common API response shapes.

// --- Auth ---

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

// --- Regex Filters ---

export type FilterCategory = 'stat' | 'modifier' | 'attribute' | 'custom';

export interface RegexFilter {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: FilterCategory;
  pattern: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegexFilterRequest {
  name: string;
  description?: string;
  category: FilterCategory;
  pattern: string;
}

export interface UpdateRegexFilterRequest {
  name?: string;
  description?: string;
  category?: FilterCategory;
  pattern?: string;
  isActive?: boolean;
}

export interface RegexTestRequest {
  pattern: string;
  text: string;
}

export interface RegexTestResult {
  line: string;
  lineNumber: number;
  matchedText: string;
}

export interface RegexTestResponse {
  matches: RegexTestResult[];
  isValid: boolean;
  error?: string;
}

// --- Trade ---

export interface TradeSearchRequest {
  filterIds: string[];
  league?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
}

export interface TradePrice {
  amount: number;
  currency: string;
}

export interface TradeResult {
  id: string;
  itemName: string;
  itemType: string;
  price: TradePrice;
  seller: string;
  whisper: string;
  mods: string[];
  listingTime: string;
}

export interface TradeSearchResponse {
  results: TradeResult[];
  total: number;
  queryId: string;
}

// --- Common ---

export interface PaginatedResponse<TItem> {
  data: TItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiResponse<TData> {
  data: TData;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}
