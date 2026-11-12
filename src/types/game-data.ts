// ABOUTME: TypeScript mirror of the game data types in the niko-community-api crate (src-tauri/community-api).
// ABOUTME: Served by the N.I.K.O. server's /v1/data routes; field names match the Rust serde camelCase output 1:1.

/** Map mod regex data from data.poe.re plus chained mod id aliases. */
export interface MapModData {
  /** data.poe.re patch, e.g. "3.30.0.1". */
  patch: string;
  /** SHA-256 (hex) of the upstream file; also the response ETag. */
  sha256: string;
  /** Passed through as published; the app validates each token before use. */
  tokens: unknown[];
  optimizationTable: unknown;
  /** Any old mod id (as a string key) → its current id. */
  aliases: Record<string, number>;
}

/** One stored atlas tree export tag, listed newest first. */
export interface AtlasVersion {
  /** GGG atlastree-export release tag, e.g. "3.30.0". */
  tag: string;
  /** RFC 3339 commit date of the tag. */
  releasedAt: string;
}
