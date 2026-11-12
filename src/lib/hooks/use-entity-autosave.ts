// ABOUTME: Shared editor autosave: updates the open entity 500 ms after the last change, or creates an
// ABOUTME: "Untitled …" entity on the first change when none is open. Saves run one at a time; pages supply an adapter.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/stores/toast-store';
import { untitledName } from '@/lib/filters-autosave';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** The page-specific parts of autosave. Define adapters as module-level constants so they stay stable. */
export interface AutosaveAdapter<C> {
  /** The zustand store's subscribe. */
  subscribe: (listener: () => void) => () => void;
  getActiveId: () => string | null;
  setActiveId: (id: string | null) => void;
  getConfig: () => C;
  /** Used by open(). */
  loadConfig: (config: C) => void;
  /** Used by startNew(). */
  clear: () => void;
  equal: (a: C | null, b: C | null) => boolean;
  isEmpty: (config: C) => boolean;
  create: (name: string, config: C) => Promise<{ id: string }>;
  update: (id: string, config: C) => Promise<void>;
  /** "Untitled preset" | "Untitled tree" */
  untitledBase: string;
  /** Invalidated after every save. */
  queryKey: readonly unknown[];
  /** Toast shown when a save fails. */
  errorMessage: string;
  /** Console prefix for save failures, e.g. "[Filters]". */
  logTag: string;
}

const SAVE_DELAY_MS = 500;

export function useEntityAutosave<C>(adapter: AutosaveAdapter<C>, existingNames: string[]) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  // Last config known to be saved for the open entity; null when none is open.
  // The store outlives the page, and leaving the page flushes, so an open entity starts in sync.
  const [initialBaseline] = useState(() => (adapter.getActiveId() ? adapter.getConfig() : null));
  const baseline = useRef<C | null>(initialBaseline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const muted = useRef(false);
  const names = useRef(existingNames);
  names.current = existingNames;

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const saveNow = useCallback(async () => {
    const activeId = adapter.getActiveId();
    const config = adapter.getConfig();
    if (activeId ? adapter.equal(config, baseline.current) : adapter.isEmpty(config)) return;
    setStatus('saving');
    try {
      if (activeId) {
        await adapter.update(activeId, config);
        baseline.current = config;
        setStatus('saved');
      } else {
        const created = await adapter.create(untitledName(names.current, adapter.untitledBase), config);
        baseline.current = config;
        // Set 'saved' before the store update so a follow-up change seen by the subscription can still show 'saving'.
        // Not muted: if the draft changed while creating, the subscription schedules the follow-up update.
        setStatus('saved');
        adapter.setActiveId(created.id);
      }
    } catch (err) {
      console.error(`${adapter.logTag} autosave failed:`, err);
      setStatus('error');
      toast.error(adapter.errorMessage);
    }
    void queryClient.invalidateQueries({ queryKey: adapter.queryKey });
  }, [adapter, queryClient]);

  const flush = useCallback((): Promise<void> => {
    clearTimer();
    chain.current = chain.current.then(saveNow);
    return chain.current;
  }, [saveNow]);

  useEffect(() => {
    const unsubscribe = adapter.subscribe(() => {
      if (muted.current) return;
      const activeId = adapter.getActiveId();
      const config = adapter.getConfig();
      const hadPending = timer.current !== null;
      clearTimer();
      const dirty = activeId ? !adapter.equal(config, baseline.current) : !adapter.isEmpty(config);
      if (!dirty) {
        // Changed back to what is saved before the timer fired.
        if (hadPending) setStatus(activeId ? 'saved' : 'idle');
        return;
      }
      setStatus('saving');
      if (activeId) {
        timer.current = setTimeout(() => { timer.current = null; void flush(); }, SAVE_DELAY_MS);
      } else {
        void flush();
      }
    });
    return () => { unsubscribe(); void flush(); };
  }, [adapter, flush]);

  /** Saves pending changes, then opens an entity without treating the load as a change. */
  const open = useCallback(async (id: string, config: C) => {
    await flush();
    muted.current = true;
    adapter.setActiveId(id);
    adapter.loadConfig(config);
    muted.current = false;
    baseline.current = adapter.getConfig();
    setStatus('idle');
  }, [adapter, flush]);

  /** Saves pending changes (or drops them with `discard`), then resets to an empty draft with nothing open. */
  const startNew = useCallback(async ({ discard = false }: { discard?: boolean } = {}) => {
    if (discard) clearTimer();
    else await flush();
    muted.current = true;
    adapter.setActiveId(null);
    adapter.clear();
    muted.current = false;
    baseline.current = null;
    setStatus('idle');
  }, [adapter, flush]);

  return { status, flush, open, startNew };
}
