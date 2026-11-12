// ABOUTME: "Published" / "Published · out of date" badge for a local strategy.
// ABOUTME: Compares the hash stored at publish time with the hash of the strategy's saved config.

import { useQuery } from '@tanstack/react-query';
import { getPublished, publishState, type PublishState } from '@/lib/community-storage';
import { strategyHash } from '@/lib/result-sharing';
import type { StrategyParsed } from '@/lib/hooks/use-strategies';

export function usePublishState(strategy: StrategyParsed): PublishState {
  const record = getPublished(strategy.id);
  const { data: savedHash } = useQuery({
    queryKey: ['strategy-hash', strategy.id, JSON.stringify(strategy.config)],
    queryFn: () => strategyHash(strategy.config),
    enabled: !!record?.hash,
    staleTime: Infinity,
  });
  return publishState(record, savedHash ?? null);
}

export function PublishBadge({ state }: { state: PublishState }) {
  if (state === 'none') return null;
  const stale = state === 'stale';
  return (
    <span
      className={`mt-0.5 inline-block rounded border px-1 text-[10px] ${
        stale ? 'border-poe-currency/40 text-poe-currency' : 'border-poe-success/40 text-poe-success'
      }`}
    >
      {stale ? 'Published · out of date' : 'Published'}
    </span>
  );
}
