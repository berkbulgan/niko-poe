// ABOUTME: Shared utility functions for class merging, clipboard operations and relative times.
// ABOUTME: Provides cn() for Tailwind class merging and formatTimeAgo() for "5m ago" labels.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { copyToClipboard as platformCopyToClipboard } from '@/lib/platform';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  return platformCopyToClipboard(text);
}

/** "just now", "5m ago", "3h ago" or "2d ago". */
export function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
