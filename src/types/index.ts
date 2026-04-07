// ABOUTME: Shared TypeScript type definitions for the C.A.D.I.R.O. frontend.
// ABOUTME: Covers auth and common API response shapes.

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

// --- Common ---

export interface ApiResponse<TData> {
  data: TData;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}
