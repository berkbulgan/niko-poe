// ABOUTME: Shared save modal for naming entities (presets, strategies, atlas trees).
// ABOUTME: Replaces SavePresetModal, SaveStrategyModal, SaveAtlasTreeModal with a single component.

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface SaveEntityModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  title: string;
  placeholder: string;
  label?: string;
}

export function SaveEntityModal({
  open,
  onClose,
  onSave,
  title,
  placeholder,
  label = 'Name',
}: SaveEntityModalProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      setName('');
      onClose();
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">{label}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
