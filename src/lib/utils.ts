// ABOUTME: Shared utility functions for class merging and clipboard operations.
// ABOUTME: Provides cn() for Tailwind class merging.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { copyToClipboard as platformCopyToClipboard } from '@/lib/platform';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  return platformCopyToClipboard(text);
}
