// ABOUTME: Filters page — preset sidebar + map mod picker.
// ABOUTME: Left panel: saved presets with share codes. Right panel: avoid/prefer mod columns.

import { useState, useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import {
  useFilterPresets,
  useCreatePreset,
  useUpdatePreset,
  useDuplicatePreset,
  useDeletePreset,
  type FilterPresetConfig,
  type FilterPreset,
} from '@/lib/hooks/use-filter-presets';
import { useImportEntity, useExportEntity } from '@/lib/hooks/use-sharing';
import { StatPicker, type StatPickerRef } from '@/components/filters/stat-picker';
import { useQueryClient, useMutation } from '@tanstack/react-query';

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
  const importEntity = useImportEntity();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.trim()) {
      importEntity.mutate({ code }, {
        onSuccess: () => { setCode(''); onClose(); },
      });
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Import Preset">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">Share Code or Pastebin URL</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="F... or pastebin.com/..."
            className="font-mono text-sm text-poe-currency"
            autoFocus
            required
          />
        </div>
        {importEntity.isError && (
          <p className="text-xs text-poe-error">Import failed. Check the code and try again.</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!code.trim() || importEntity.isPending}>
            {importEntity.isPending ? 'Importing...' : 'Import'}
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
  onDuplicate,
  onExport,
}: {
  preset: FilterPreset;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}) {
  const deletePreset = useDeletePreset(preset.id);

  return (
    <div className={`border-l-2 transition-all duration-100 ${active ? 'border-poe-gold bg-poe-gold/8' : 'border-transparent hover:bg-poe-panel-light/30'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-2 text-left"
      >
        <span className="block truncate text-sm text-poe-text">{preset.name}</span>
      </button>
      {active && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <button
            onClick={onExport}
            className="text-xs text-poe-text-dim hover:text-poe-gold"
          >
            Export
          </button>
          <span className="text-poe-border">·</span>
          <button
            onClick={onDuplicate}
            className="text-xs text-poe-text-dim hover:text-poe-gold"
          >
            Duplicate
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

export function Filters() {
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const pickerRef = useRef<StatPickerRef>(null);

  const { data: presets, isLoading } = useFilterPresets();
  const createPreset = useCreatePreset();
  const duplicatePreset = useDuplicatePreset();
  const exportEntity = useExportEntity();

  // Find active preset for Save (overwrite) operation
  const activePreset = presets?.find((p) => p.id === activePresetId);

  function handleSaveAs(name: string) {
    const config = pickerRef.current?.getConfig();
    if (!config) {
      console.error('[Filters] getConfig() returned null — StatPicker ref not attached');
      return;
    }
    createPreset.mutate({ name, config }, {
      onSuccess: (saved) => {
        setActivePresetId(saved.id);
        void queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      },
      onError: (err) => { console.error('[Filters] createPreset failed:', err); },
    });
  }

  const queryClient = useQueryClient();

  // Phase 2: replace with ipc.updateFilterPreset() call
  const updatePreset = useUpdatePreset(activePresetId ?? '');

  function handleSaveOverwrite() {
    if (!activePresetId) return;
    const config = pickerRef.current?.getConfig();
    if (!config) return;
    updatePreset.mutate({ config }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      },
    });
  }

  function handleDuplicate(preset: FilterPreset) {
    duplicatePreset.mutate(
      { name: `${preset.name} (copy)`, config: preset.config },
      { onSuccess: (dup) => { setActivePresetId(dup.id); pickerRef.current?.loadConfig(dup.config); } },
    );
  }

  function handleLoadPreset(preset: FilterPreset) {
    setActivePresetId(preset.id);
    pickerRef.current?.loadConfig(preset.config);
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      {/* ── Left panel: Presets ── */}
      <aside className="flex w-48 shrink-0 flex-col border-r border-poe-border/30 xl:w-56">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Presets</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
            Import
          </Button>
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
                  onDuplicate={() => handleDuplicate(preset)}
                  onExport={() => exportEntity.mutate({ type: 'F', name: preset.name, config: preset.config })}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Right panel: Map Mod Picker ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">Map Mod Picker</h3>
          <div className="flex gap-2">
            {activePreset && (
              <Button variant="ghost" size="sm" onClick={handleSaveOverwrite}>Save</Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setShowSaveAs(true)}>
              {activePreset ? 'Save As' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <StatPicker ref={pickerRef} />
        </div>
      </main>

      <SavePresetModal open={showSaveAs} onClose={() => setShowSaveAs(false)} onSave={handleSaveAs} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
