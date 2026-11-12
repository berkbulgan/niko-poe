// ABOUTME: Platform abstraction layer for browser APIs that differ in Tauri vs browser.
// ABOUTME: All window.*, localStorage, clipboard, external link and local file URL calls go through here.

import { open } from '@tauri-apps/plugin-shell';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { convertFileSrc } from '@tauri-apps/api/core';
import { confirm, type ConfirmOptions } from '@/lib/stores/confirm-store';

// --- Storage ---
// localStorage is acceptable in Phase 1 (non-sensitive: league preference).
// GGG OAuth tokens will use tauri-plugin-store in Phase 4.

export const storage = {
  get(key: string): string | null {
    return localStorage.getItem(key);
  },
  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
} as const;

// --- External links ---
// In Tauri, window.open() opens inside the WebView — not what we want.
// Use tauri shell open() to launch URLs in the system browser.

export async function openExternal(url: string): Promise<void> {
  await open(url);
}

// --- Clipboard ---

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    return false;
  }
}

// --- Dialogs ---

/** Asks in the app's AlertDialog (rendered by ConfirmProvider); resolves true when the user confirms. */
export function confirmAction(title: string, options: Omit<ConfirmOptions, 'title'> = {}): Promise<boolean> {
  return confirm({ title, ...options });
}

/** Resolves true when it's OK to replace the editor contents (nothing unsaved, or the user agreed). */
export function confirmDiscard(hasUnsavedChanges: boolean): Promise<boolean> {
  if (!hasUnsavedChanges) return Promise.resolve(true);
  return confirmAction('You have unsaved changes. Discard them?', { confirmLabel: 'Discard', destructive: true });
}

// --- Windows ---

/** The in-game overlay is a second Tauri window loading `#/overlay`. */
export function isOverlayWindow(): boolean {
  return window.location.hash.startsWith('#/overlay');
}

// --- Local files ---

/** A URL the WebView can load for a file in the app data dir's game-data folder (Tauri asset protocol). */
export function assetFileUrl(path: string): string {
  return convertFileSrc(path);
}
