// ABOUTME: Autosaves the Regex Filters draft: updates the open preset 500 ms after the last change,
// ABOUTME: or creates an "Untitled preset" on the first change when none is open. Saves run one at a time.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import { useFiltersStore } from '@/lib/stores/filters-store';
import { toast } from '@/lib/stores/toast-store';
import { configsEqual, isEmptyConfig, untitledName } from '@/lib/filters-autosave';
import type { FilterPresetConfig } from '@/types/filters';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY_MS = 500;

export function useFiltersAutosave(presetNames: string[]) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  // Last config known to be saved for the open preset; null when no preset is open.
  // The store outlives this page, and leaving the page flushes, so an open preset starts in sync.
  const [initialBaseline] = useState(() => {
    const s = useFiltersStore.getState();
    return s.activePresetId ? s.getConfig() : null;
  });
  const baseline = useRef<FilterPresetConfig | null>(initialBaseline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const muted = useRef(false);
  const names = useRef(presetNames);
  names.current = presetNames;

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const saveNow = useCallback(async () => {
    const { activePresetId, getConfig, setActivePresetId } = useFiltersStore.getState();
    const config = getConfig();
    if (activePresetId ? configsEqual(config, baseline.current) : isEmptyConfig(config)) return;
    setStatus('saving');
    try {
      if (activePresetId) {
        await ipc.updateFilterPreset(activePresetId, { config: JSON.stringify(config) });
        baseline.current = config;
      } else {
        const created = await ipc.createFilterPreset({ name: untitledName(names.current), config: JSON.stringify(config) });
        baseline.current = config;
        // Not muted: if the draft changed while creating, the subscription schedules the follow-up update.
        setActivePresetId(created.id);
      }
      setStatus('saved');
    } catch (err) {
      console.error('[Filters] autosave failed:', err);
      setStatus('error');
      toast.error('Could not save preset');
    }
    void queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
  }, [queryClient]);

  const flush = useCallback((): Promise<void> => {
    clearTimer();
    chain.current = chain.current.then(saveNow);
    return chain.current;
  }, [saveNow]);

  useEffect(() => {
    const unsubscribe = useFiltersStore.subscribe(() => {
      if (muted.current) return;
      const { activePresetId, getConfig } = useFiltersStore.getState();
      const config = getConfig();
      const hadPending = timer.current !== null;
      clearTimer();
      const dirty = activePresetId ? !configsEqual(config, baseline.current) : !isEmptyConfig(config);
      if (!dirty) {
        // Changed back to what is saved before the timer fired.
        if (hadPending) setStatus(activePresetId ? 'saved' : 'idle');
        return;
      }
      setStatus('saving');
      if (activePresetId) {
        timer.current = setTimeout(() => { timer.current = null; void flush(); }, SAVE_DELAY_MS);
      } else {
        void flush();
      }
    });
    return () => { unsubscribe(); void flush(); };
  }, [flush]);

  /** Saves pending changes, then opens a preset without treating the load as a change. */
  const open = useCallback(async (id: string, config: FilterPresetConfig) => {
    await flush();
    const s = useFiltersStore.getState();
    muted.current = true;
    s.setActivePresetId(id);
    s.loadConfig(config);
    muted.current = false;
    baseline.current = useFiltersStore.getState().getConfig();
    setStatus('idle');
  }, [flush]);

  /** Saves pending changes (or drops them with `discard`), then resets to an empty draft with no preset open. */
  const startNew = useCallback(async ({ discard = false }: { discard?: boolean } = {}) => {
    if (discard) clearTimer();
    else await flush();
    const s = useFiltersStore.getState();
    muted.current = true;
    s.setActivePresetId(null);
    s.clearAll();
    muted.current = false;
    baseline.current = null;
    setStatus('idle');
  }, [flush]);

  return { status, flush, open, startNew };
}
