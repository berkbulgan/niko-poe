// ABOUTME: Holds the one pending confirmation the AlertDialog shows; confirm() returns the user's answer.
// ABOUTME: A new request settles any pending one as false so callers never hang.

import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (value: boolean) => void }) | null;
}

export const useConfirmStore = create<ConfirmState>(() => ({ request: null }));

export function settle(value: boolean): void {
  const { request } = useConfirmStore.getState();
  if (!request) return;
  useConfirmStore.setState({ request: null });
  request.resolve(value);
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  settle(false);
  return new Promise((resolve) => {
    useConfirmStore.setState({ request: { ...options, resolve } });
  });
}
