// ABOUTME: Map tracking hooks — live tracker state pushed from Rust, run history, map reassignment, settings.
// ABOUTME: Every tracker-state event refetches history and settings, so open pages stay current.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import type { TrackerSettings, TrackerSettingsInput, TrackerState, TrackingRunDetail } from '@/types/tracking';

const HISTORY_KEY = ['tracking-history'] as const;
const SETTINGS_KEY = ['tracker-settings'] as const;

export function useTrackerState(): TrackerState | null {
  const [state, setState] = useState<TrackerState | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void ipc
      .onTrackerState((next) => {
        setState(next);
        void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
        void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    void ipc.getTrackerState().then((initial) => {
      if (!cancelled) setState((prev) => prev ?? initial);
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [queryClient]);

  return state;
}

export function useTrackingHistory() {
  return useQuery<TrackingRunDetail[]>({ queryKey: [...HISTORY_KEY], queryFn: ipc.getTrackingHistory });
}

export function useReassignMapRuns() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mapIds, strategyId }: { mapIds: string[]; strategyId: string | null }) =>
      ipc.reassignMapRuns(mapIds, strategyId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}

export function useDeleteTrackingRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipc.deleteTrackingRun(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}

export function useTrackerSettings() {
  return useQuery<TrackerSettings>({ queryKey: [...SETTINGS_KEY], queryFn: ipc.getTrackerSettings });
}

export function useSetTrackerSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TrackerSettingsInput) => ipc.setTrackerSettings(input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}
