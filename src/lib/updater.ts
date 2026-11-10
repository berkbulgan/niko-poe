// ABOUTME: Checks GitHub Releases for a newer signed build on startup and offers to install it.
// ABOUTME: Does nothing outside the Tauri runtime or when the check fails (offline, rate limit).

import { check } from '@tauri-apps/plugin-updater';
import { toError } from '@/lib/ipc';
import { confirmAction } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';

// StrictMode runs effects twice in dev; only ever ask once per launch.
let checked = false;

export async function checkForUpdate(): Promise<void> {
  if (checked) return;
  checked = true;

  let update;
  try {
    update = await check();
  } catch {
    return;
  }
  if (!update) return;

  const install = await confirmAction('Update available', {
    description: `N.I.K.O. ${update.version} is available. The app will close to install it.`,
    confirmLabel: 'Install and restart',
  });
  if (!install) return;
  try {
    await update.downloadAndInstall();
  } catch (err) {
    toast.error(`Update failed: ${toError(err).message}`);
  }
}
