// ABOUTME: Checks GitHub Releases for a newer signed build (on startup, or from Settings) and installs it.
// ABOUTME: The startup check is skipped when auto-check is off, and does nothing when the check fails.

import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { toError } from '@/lib/ipc';
import { confirmAction, storage } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';

export type { Update };

const AUTO_CHECK_KEY = 'niko_auto_update_check';

export function getAutoCheck(): boolean {
  return storage.get(AUTO_CHECK_KEY) !== 'off';
}

export function setAutoCheck(on: boolean): void {
  storage.set(AUTO_CHECK_KEY, on ? 'on' : 'off');
}

/** The installed app version. Rejects outside the Tauri runtime. */
export const installedVersion = getVersion;

/** The newer release, or null when this build is the latest. Rejects when the check fails. */
export const findUpdate = check;

/** Downloads and runs the installer, which closes the app. */
export async function installUpdate(update: Update): Promise<void> {
  try {
    await update.downloadAndInstall();
  } catch (err) {
    toast.error(`Update failed: ${toError(err).message}`);
  }
}

// StrictMode runs effects twice in dev; only ever ask once per launch.
let checked = false;

export async function checkForUpdate(): Promise<void> {
  if (checked || !getAutoCheck()) return;
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
  if (install) await installUpdate(update);
}
