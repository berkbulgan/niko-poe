// ABOUTME: Decides which strategies of a stopped tracking run can share their result with the community.
// ABOUTME: A strategy qualifies only while its config still matches the community version it came from.

import { linkedCommunityId } from '@/lib/community-storage';
import type { StrategyParsed } from '@/lib/hooks/use-strategies';
import * as ipc from '@/lib/ipc';
import { resultPayload, strategyResults, type ResultPayload } from '@/lib/tracking-results';
import type { StrategyConfig } from '@/types/strategies';
import type { TrackingRunDetail } from '@/types/tracking';

/** Same canonical SHA-256 the sharing code uses; key order does not matter. */
export function strategyHash(config: StrategyConfig): Promise<string> {
  return ipc.contentHash(JSON.stringify(config));
}

export interface ShareCandidate {
  communityId: string;
  strategyName: string;
  payload: ResultPayload;
}

/** `communityIds` maps local strategy id → the community id it is still linked to. */
export function shareCandidates(
  run: TrackingRunDetail,
  strategies: StrategyParsed[],
  communityIds: Record<string, string>,
): ShareCandidate[] {
  return strategies.flatMap((s) => {
    const communityId = communityIds[s.id];
    if (!communityId) return [];
    const row = strategyResults(s.id, [run], s.config).rows[0];
    const payload = row ? resultPayload(row) : null;
    return payload ? [{ communityId, strategyName: s.name, payload }] : [];
  });
}

/** Hashes only the strategies that played maps in this run. */
export async function findShareCandidates(
  run: TrackingRunDetail,
  strategies: StrategyParsed[],
): Promise<ShareCandidate[]> {
  const played = new Set(run.maps.map((m) => m.strategyId ?? run.strategyId));
  const communityIds: Record<string, string> = {};
  for (const s of strategies.filter((x) => played.has(x.id))) {
    const id = linkedCommunityId(s.id, await strategyHash(s.config));
    if (id) communityIds[s.id] = id;
  }
  return shareCandidates(run, strategies, communityIds);
}
