// ABOUTME: Reusable export modal that shows a share code with a copy button.
// ABOUTME: Encodes the entity on open, displays result in a readonly input.

import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useExportEntity, type ExportInput } from '@/lib/hooks/use-sharing';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  input: ExportInput | null;
}

export function ExportModal({ open, onClose, input }: ExportModalProps) {
  const exportEntity = useExportEntity();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger encode when modal opens with input.
  useEffect(() => {
    if (open && input) {
      setCopied(false);
      exportEntity.mutate(input);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, input]);

  function handleCopy() {
    // copyToClipboard is already called inside useExportEntity, but the code
    // is also in the mutation result — select + copy the input for visual feedback.
    if (exportEntity.data) {
      void navigator.clipboard.writeText(exportEntity.data).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  function handleClose() {
    setCopied(false);
    exportEntity.reset();
    onClose();
  }

  // Select all text when clicking the input.
  function handleInputFocus() {
    inputRef.current?.select();
  }

  const title = input?.type === 'F' ? 'Export Filter Preset'
    : input?.type === 'A' ? 'Export Atlas Tree'
    : input?.type === 'S' ? 'Export Strategy'
    : 'Export';

  return (
    <Modal isOpen={open} onClose={handleClose} title={title}>
      <div className="space-y-4">
        {exportEntity.isPending && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Spinner />
            <span className="text-sm text-poe-text-muted">Encoding...</span>
          </div>
        )}

        {exportEntity.isError && (
          <p className="text-sm text-poe-error">
            Export failed: {exportEntity.error.message}
          </p>
        )}

        {exportEntity.data && (
          <>
            <div>
              <label className="mb-1.5 block text-xs text-poe-text-muted">Share Code</label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={exportEntity.data}
                  readOnly
                  onFocus={handleInputFocus}
                  className="flex-1 font-mono text-xs text-poe-currency"
                />
                <Button variant="primary" size="sm" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            {copied && (
              <p className="text-xs text-poe-gold">Share code copied to clipboard.</p>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
