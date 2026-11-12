// ABOUTME: Preview of a community strategy's filter preset: the stash regex it builds, with its length and a Copy button.
// ABOUTME: The regex comes from presetRegex, the same function the Filters page uses.

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { presetRegex } from '@/lib/preset-regex';
import { copyToClipboard } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';
import type { FilterPresetPayload } from '@/lib/hooks/use-sharing';

const REGEX_LIMIT = 250;

export function PresetPreviewModal({ preset, onClose }: { preset: FilterPresetPayload | null; onClose: () => void }) {
  const regex = preset ? presetRegex(preset.config) : '';

  async function handleCopy() {
    if (await copyToClipboard(regex)) toast.success('Regex copied');
    else toast.error('Could not copy to clipboard');
  }

  return (
    <Modal isOpen={preset !== null} onClose={onClose} title={preset?.name}>
      {regex ? (
        <div>
          <p className="break-all font-mono text-sm text-poe-currency">{regex}</p>
          <p className={`mt-1 text-xs ${regex.length > REGEX_LIMIT ? 'text-poe-error' : 'text-poe-text-muted'}`}>
            {regex.length}/{REGEX_LIMIT}
          </p>
        </div>
      ) : (
        <p className="text-sm text-poe-text-muted">This preset has no regex filters.</p>
      )}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => void handleCopy()} disabled={!regex}>
          Copy
        </Button>
      </div>
    </Modal>
  );
}
