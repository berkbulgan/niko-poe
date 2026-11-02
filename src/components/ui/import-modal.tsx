// ABOUTME: Reusable import modal that previews decoded share code contents before importing.
// ABOUTME: Decodes on paste, shows entity names/types, imports on confirmation.

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useImportEntity } from '@/lib/hooks/use-sharing';
import * as ipc from '@/lib/ipc';
import { isCommunityId } from '@/lib/community-storage';

interface PreviewItem {
  type: string;
  name: string;
}

type EntityType = 'F' | 'A' | 'S';

const TYPE_LABELS: Record<EntityType, string> = {
  F: 'Filter Preset',
  A: 'Atlas Tree',
  S: 'Strategy',
};

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  /** Share code fetched from the community server when a community id was entered. */
  const [communityCode, setCommunityCode] = useState<string | null>(null);
  const importEntity = useImportEntity();

  const resetState = useCallback(() => {
    setCode('');
    setPreview(null);
    setPreviewError(null);
    setIsPreviewing(false);
    setCommunityCode(null);
    importEntity.reset();
  }, [importEntity]);

  // Reset state when modal closes.
  useEffect(() => {
    if (!open) {
      resetState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function decodePreview(input: string) {
    const trimmed = input.trim();
    if (!trimmed) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    setIsPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    setCommunityCode(null);

    try {
      let shareCode = trimmed;

      // If it looks like a pastebin URL, fetch the raw content first.
      if (/pastebin\.com/i.test(shareCode)) {
        shareCode = await ipc.importFromPastebin(shareCode);
      } else if (isCommunityId(shareCode)) {
        shareCode = (await ipc.communityGet(shareCode)).shareCode;
        setCommunityCode(shareCode);
      }

      const decoded = await ipc.decodeShareCode(shareCode);
      const entityType = decoded.entityType as EntityType;
      const payload: unknown = JSON.parse(decoded.payloadJson);
      const items: PreviewItem[] = [];

      if (entityType === 'S') {
        const bundle = payload as { name: string; filterPreset: { name: string } | null; atlasTree: { name: string } | null };
        items.push({ type: TYPE_LABELS.S, name: bundle.name });
        if (bundle.filterPreset) {
          items.push({ type: TYPE_LABELS.F, name: bundle.filterPreset.name });
        }
        if (bundle.atlasTree) {
          items.push({ type: TYPE_LABELS.A, name: bundle.atlasTree.name });
        }
      } else {
        const entity = payload as { name: string };
        items.push({ type: TYPE_LABELS[entityType], name: entity.name });
      }

      setPreview(items);
    } catch (err) {
      setPreviewError(isCommunityId(trimmed)
        ? `Community strategy not available: ${err instanceof Error ? err.message : String(err)}`
        : 'Invalid share code. Check and try again.');
      setPreview(null);
    } finally {
      setIsPreviewing(false);
    }
  }

  function handleCodeChange(value: string) {
    setCode(value);
    importEntity.reset();
    void decodePreview(value);
  }

  function handleImport() {
    if (!code.trim()) return;
    importEntity.mutate({ code: communityCode ?? code.trim() }, {
      onSuccess: () => {
        onClose();
      },
    });
  }

  function handleClose() {
    onClose();
  }

  return (
    <Modal isOpen={open} onClose={handleClose} title="Import">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">Share Code, Pastebin URL or Community ID</label>
          <Input
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="F... / A... / S... or pastebin.com/..."
            className="font-mono text-sm text-poe-currency"
            autoFocus
          />
        </div>

        {isPreviewing && (
          <div className="flex items-center gap-2 py-2">
            <Spinner />
            <span className="text-xs text-poe-text-muted">Decoding...</span>
          </div>
        )}

        {previewError && (
          <p className="text-xs text-poe-error">{previewError}</p>
        )}

        {preview && preview.length > 0 && (
          <div className="rounded border border-poe-border/30 bg-poe-panel-light/20 p-3">
            <p className="mb-2 text-xs font-semibold text-poe-text-dim">Will import:</p>
            <ul className="space-y-1">
              {preview.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-poe-gold/15 px-1.5 py-0.5 text-xs font-medium text-poe-gold">
                    {item.type}
                  </span>
                  <span className="text-poe-text">{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {importEntity.isError && (
          <p className="text-xs text-poe-error">Import failed: {importEntity.error.message}</p>
        )}

        {importEntity.isSuccess && (
          <p className="text-xs text-poe-gold">Imported successfully!</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!preview || preview.length === 0 || importEntity.isPending}
          >
            {importEntity.isPending ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
