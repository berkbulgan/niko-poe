// ABOUTME: In-game overlay — suggests tracking when a map starts, then shows the run with switch/stop controls.
// ABOUTME: Rendered alone in the "overlay" Tauri window; run state comes from the Rust tracker.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getInstallId } from '@/lib/community-storage';
import { useSnapshotConfigs } from '@/lib/hooks/use-snapshots';
import { useStrategies } from '@/lib/hooks/use-strategies';
import { useTrackerState } from '@/lib/hooks/use-tracking';
import * as ipc from '@/lib/ipc';
import { storedLeagueId } from '@/lib/league-context';
import { storage } from '@/lib/platform';
import { findShareCandidates, type ShareCandidate } from '@/lib/result-sharing';
import type { SnapshotConfig } from '@/types/snapshots';

const POS_KEY = 'niko_overlay_pos';
const LAST_STRATEGY_KEY = 'niko_last_tracking_strategy';
const LAST_CONFIG_KEY = 'niko_last_tracking_config';
const EXPLAINED_KEY = 'niko_results_explained';

type Action = { kind: 'start' } | { kind: 'stop' } | { kind: 'switch'; strategyId: string };

/** The strategy's linked config, else the last config used for tracking, else the most recently updated one. */
function pickConfigId(strategyId: string, configs: SnapshotConfig[]): string | null {
  const lastUsed = storage.get(LAST_CONFIG_KEY);
  return (
    configs.find((c) => c.strategyId === strategyId)?.id ??
    configs.find((c) => c.id === lastUsed)?.id ??
    configs[0]?.id ??
    null
  );
}

function elapsed(startedAt: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(startedAt + 'Z').getTime()) / 60_000));
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

type ShareState = 'idle' | 'sending' | 'shared' | 'duplicate' | { error: string };

function ShareCard({ candidate, onDone }: { candidate: ShareCandidate; onDone: () => void }) {
  const [state, setState] = useState<ShareState>('idle');
  const [firstTime] = useState(() => storage.get(EXPLAINED_KEY) === null);
  const { maps, hours, netDivine } = candidate.payload;

  async function share() {
    setState('sending');
    storage.set(EXPLAINED_KEY, '1');
    try {
      const stored = await ipc.communitySubmitResult(candidate.communityId, {
        installId: getInstallId(),
        league: storedLeagueId(),
        ...candidate.payload,
      });
      setState(stored ? 'shared' : 'duplicate');
      setTimeout(onDone, 2500);
    } catch (err) {
      setState({ error: ipc.toError(err).message });
    }
  }

  if (state === 'shared') return <p data-tauri-drag-region className="text-poe-gold">Shared — thanks!</p>;
  if (state === 'duplicate') return <p data-tauri-drag-region className="text-poe-text-dim">Already shared today for this strategy</p>;
  return (
    <>
      <p data-tauri-drag-region className="truncate text-poe-gold">{candidate.strategyName}</p>
      <p data-tauri-drag-region className="text-poe-gold">
        {maps} maps · {(netDivine / hours).toFixed(1)} div/hr — share to community?
      </p>
      {firstTime && <p data-tauri-drag-region className="text-poe-text-muted">Only map count, time and profit are sent. Anonymous.</p>}
      {typeof state === 'object' && <p data-tauri-drag-region className="text-red-400">{state.error}</p>}
      <div className="mt-1 flex gap-1">
        <Button size="sm" onClick={() => void share()} disabled={state === 'sending'}>
          {typeof state === 'object' ? 'Retry' : 'Share'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={state === 'sending'}>No</Button>
      </div>
    </>
  );
}

export function Overlay() {
  const tracker = useTrackerState();
  const { data: strategies, refetch: refetchStrategies } = useStrategies();
  const { data: configs } = useSnapshotConfigs();
  const [strategyId, setStrategyId] = useState<string | null>(() => storage.get(LAST_STRATEGY_KEY));
  const [error, setError] = useState<{ message: string; retry: Action } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [shares, setShares] = useState<ShareCandidate[]>([]);

  useEffect(() => {
    const unlisten = ipc.persistOverlayPosition(
      () => {
        const raw = storage.get(POS_KEY);
        return raw ? (JSON.parse(raw) as { x: number; y: number }) : null;
      },
      (pos) => storage.set(POS_KEY, JSON.stringify(pos)),
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const run = tracker?.activeRun ?? null;
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [run]);

  if (!tracker) return null;

  const selected =
    strategies?.find((s) => s.id === (run?.strategyId ?? strategyId)) ?? strategies?.[0] ?? null;
  const configId = selected ? pickConfigId(selected.id, configs ?? []) : null;

  async function perform(action: Action) {
    setError(null);
    try {
      if (action.kind === 'start') {
        if (!selected || !configId) return;
        storage.set(LAST_STRATEGY_KEY, selected.id);
        storage.set(LAST_CONFIG_KEY, configId);
        await ipc.startTrackingRun(selected.id, configId);
      } else if (action.kind === 'switch') {
        storage.set(LAST_STRATEGY_KEY, action.strategyId);
        await ipc.switchTrackingStrategy(action.strategyId);
      } else {
        const stoppedId = run?.id;
        await ipc.stopTrackingRun(false);
        if (stoppedId) {
          try {
            // The overlay's query cache is never invalidated, so read the strategies fresh.
            const fresh = (await refetchStrategies()).data;
            const stopped = (await ipc.getTrackingHistory()).find((r) => r.id === stoppedId);
            if (stopped && fresh) setShares(await findShareCandidates(stopped, fresh));
          } catch {
            // Sharing is optional; a lookup failure must not show up as a stop error.
          }
        }
      }
    } catch (err) {
      setError({ message: ipc.toError(err).message, retry: action });
    }
  }

  // Native on purpose: a Radix dropdown would be clipped by the small overlay window.
  const strategySelect = (onChange: (id: string) => void) => (
    <select
      value={selected?.id ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={tracker.busy}
      aria-label="Strategy"
      className="min-w-0 flex-1 rounded-md border border-input bg-card px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {strategies?.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );

  let body: React.ReactNode;
  if (error) {
    body = (
      <>
        <p data-tauri-drag-region className="text-red-400">{error.message}</p>
        <div className="mt-1 flex gap-1">
          <Button size="sm" onClick={() => void perform(error.retry)}>Retry</Button>
          {run && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void ipc.stopTrackingRun(true).then(() => setError(null), (err: unknown) => setError({ message: ipc.toError(err).message, retry: error.retry }))}
            >
              End without snapshot
            </Button>
          )}
          <Button size="sm" variant="ghost" aria-label="Dismiss" onClick={() => setError(null)}><X size={14} /></Button>
        </div>
      </>
    );
  } else if (tracker.busy) {
    body = <p data-tauri-drag-region className="flex items-center gap-2"><Spinner size="sm" /> Taking snapshot…</p>;
  } else if (run) {
    body = (
      <>
        <div className="flex items-center gap-1">
          {strategySelect((id) => void perform({ kind: 'switch', strategyId: id }))}
          <Button size="sm" variant="danger" onClick={() => void perform({ kind: 'stop' })}>Stop</Button>
        </div>
        <p data-tauri-drag-region className="mt-1 tabular-nums text-poe-text-dim">
          {run.mapCount} maps · {elapsed(run.startedAt, now)}
          {tracker.inMap && tracker.currentMap ? ` · ${tracker.currentMap.name}` : ''}
        </p>
        <p data-tauri-drag-region className="text-poe-text-muted">Stash your loot before stopping.</p>
      </>
    );
  } else if (shares.length > 0) {
    body = <ShareCard key={shares.length} candidate={shares[0]} onDone={() => setShares((s) => s.slice(1))} />;
  } else if (tracker.suggestTracking) {
    body = !strategies?.length ? (
      <p data-tauri-drag-region>Save a strategy first to track maps.</p>
    ) : !configId ? (
      <p data-tauri-drag-region>Create a snapshot config on the Stash page first.</p>
    ) : (
      <>
        <div data-tauri-drag-region className="flex items-center justify-between">
          <span data-tauri-drag-region className="text-poe-gold">Looks like you&apos;re in a map — Track?</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => void ipc.dismissTrackingSuggestion()}
            className="text-poe-text-dim hover:text-poe-text"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1">
          {strategySelect(setStrategyId)}
          <Button size="sm" onClick={() => void perform({ kind: 'start' })}>Start</Button>
        </div>
      </>
    );
  } else {
    body = <p data-tauri-drag-region className="text-poe-text-dim">N.I.K.O. · idle</p>;
  }

  return (
    <div
      data-tauri-drag-region
      className="m-1 select-none rounded border border-poe-gold/40 bg-poe-bg/90 p-2 text-xs text-poe-text shadow-lg"
    >
      {body}
    </div>
  );
}
