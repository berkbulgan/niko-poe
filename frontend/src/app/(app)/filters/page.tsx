// ABOUTME: Filters page — preset sidebar + map mod picker.
// ABOUTME: Left panel: saved presets with share codes. Right panel: avoid/prefer mod columns.

'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import {
  useFilterPresets,
  useCreatePreset,
  useDeletePreset,
  useImportPreset,
  type FilterPresetConfig,
  type FilterPreset,
} from '@/lib/hooks/use-filter-presets';
import { StatPicker, type StatPickerRef } from '@/components/filters/stat-picker';
import { copyToClipboard } from '@/lib/utils';
import { useRef } from 'react';

function SavePresetModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
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
    <Modal isOpen={open} onClose={onClose} title="Save Preset">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">Preset Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Breach-RF, Expedition, Bow Maps..."
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

function ImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const importPreset = useImportPreset(code);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length === 8) {
      importPreset.mutate(undefined, {
        onSuccess: () => { setCode(''); onClose(); },
      });
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Import Preset">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">8-Digit Share Code</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="12345678"
            maxLength={8}
            className="font-mono text-lg tracking-[0.3em] text-poe-currency"
            autoFocus
            required
          />
        </div>
        {importPreset.isError && (
          <p className="text-xs text-poe-error">Preset not found. Check the code.</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={code.length !== 8 || importPreset.isPending}>
            {importPreset.isPending ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PresetRow({
  preset,
  active,
  onSelect,
}: {
  preset: FilterPreset;
  active: boolean;
  onSelect: () => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const deletePreset = useDeletePreset(preset.id);

  return (
    <div className={`border-l-2 transition-all duration-100 ${active ? 'border-poe-gold bg-poe-gold/8' : 'border-transparent hover:bg-poe-panel-light/30'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-2 text-left"
      >
        <span className="block truncate text-sm text-poe-text">{preset.name}</span>
        <span className="block text-xs text-poe-text-muted">
          Code: {preset.shareCode}
        </span>
      </button>
      {active && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <button
            onClick={async () => {
              await copyToClipboard(preset.shareCode);
              setShowCode(true);
              setTimeout(() => setShowCode(false), 2000);
            }}
            className={`text-xs ${showCode ? 'text-poe-success' : 'text-poe-text-dim hover:text-poe-gold'}`}
          >
            {showCode ? 'Copied!' : 'Share'}
          </button>
          <span className="text-poe-border">·</span>
          <button
            onClick={() => deletePreset.mutate(undefined)}
            disabled={deletePreset.isPending}
            className="text-xs text-poe-text-dim hover:text-poe-error"
          >
            {deletePreset.isPending ? '...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FiltersPage() {
  const [showSave, setShowSave] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const pickerRef = useRef<StatPickerRef>(null);

  const { data: presets, isLoading } = useFilterPresets();
  const createPreset = useCreatePreset();

  function handleSave(name: string) {
    const config = pickerRef.current?.getConfig();
    if (!config) return;
    createPreset.mutate({ name, config });
  }

  function handleLoadPreset(preset: FilterPreset) {
    setActivePresetId(preset.id);
    pickerRef.current?.loadConfig(preset.config);
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left panel: Presets ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-poe-border/30 xl:w-72">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Presets</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
              Import
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowSave(true)}>
              Save
            </Button>
          </div>
        </div>

        {/* Preset list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !presets || presets.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-poe-text-dim">No presets saved</p>
              <p className="mt-1 text-xs text-poe-text-muted">
                Configure your filters and hit Save
              </p>
            </div>
          ) : (
            <div className="space-y-px p-1">
              {presets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  active={activePresetId === preset.id}
                  onSelect={() => handleLoadPreset(preset)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Right panel: Map Mod Picker ── */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <StatPicker ref={pickerRef} />
      </main>

      <SavePresetModal open={showSave} onClose={() => setShowSave(false)} onSave={handleSave} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
