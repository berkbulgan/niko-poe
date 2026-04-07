// ABOUTME: Platform abstraction layer for browser APIs that differ in Tauri vs browser.
// ABOUTME: All window.*, localStorage, clipboard, and external link calls go through here.

import { open } from '@tauri-apps/plugin-shell';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

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
