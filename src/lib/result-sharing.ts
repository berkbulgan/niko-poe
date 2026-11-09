// ABOUTME: Decides which strategies of a stopped tracking run can share their result with the community.
// ABOUTME: A strategy qualifies only while its config still matches the community version it came from.

import * as ipc from '@/lib/ipc';
import type { StrategyConfig } from '@/types/strategies';

/** Same canonical SHA-256 the sharing code uses; key order does not matter. */
export function strategyHash(config: StrategyConfig): Promise<string> {
  return ipc.contentHash(JSON.stringify(config));
}
