// ABOUTME: Regex Filters page — preset sidebar + map mod picker, autosaved.
// ABOUTME: Toolbar shows the open preset's editable name, save status and a New preset button.

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useFilterPresets,
  useUpdatePreset,
  useDuplicatePreset,
  useDeletePreset,
  type FilterPresetParsed,
} from '@/lib/hooks/use-filter-presets';
import { useFiltersAutosave, type AutosaveStatus } from '@/lib/hooks/use-filters-autosave';
import { useUsedIn } from '@/lib/hooks/use-strategies';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatPicker } from '@/components/filters/stat-picker';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { useFiltersStore } from '@/lib/stores/filters-store';

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
};

function PresetRow({
  preset,
  active,
  onSelect,
  onDuplicate,
  onExport,
  onBeforeDelete,
}: {
  preset: FilterPresetParsed;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onBeforeDelete: () => void;
}) {
  const deletePreset = useDeletePreset(preset.id);
  const usedIn = useUsedIn('filterPresetId', preset.id);

  return (
    <SidebarEntityRow
      name={preset.name}
      active={active}
      onSelect={onSelect}
      onExport={onExport}
      onDuplicate={onDuplicate}
      onDelete={() => { onBeforeDelete(); deletePreset.mutate(undefined); }}
      isDeleting={deletePreset.isPending}
      subtitle={usedIn.length > 0 && (
        <span className="block truncate text-xs text-poe-text-muted">Used in {usedIn.join(', ')}</span>
      )}
    />
  );
}

/** Click to rename; Enter or blur saves, Escape cancels, a blank name reverts. */
function PresetName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(name)}
        title="Rename"
        className="truncate text-sm font-semibold tracking-wide text-poe-text-dim hover:text-poe-text"
      >
        {name}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim();
        setDraft(null);
        if (cancelled.current) { cancelled.current = false; return; }
        if (next && next !== name) onRename(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
      }}
      aria-label="Preset name"
      className="h-7 w-64 text-sm"
    />
  );
}

export function Filters() {
  const [showImport, setShowImport] = useState(false);
  const [exportInput, setExportInput] = useState<ExportInput | null>(null);

  const { activePresetId, getConfig } = useFiltersStore();
  const { data: presets, isLoading } = useFilterPresets();
  const duplicatePreset = useDuplicatePreset();
  const updatePreset = useUpdatePreset(activePresetId ?? '');
  const { status, flush, open, startNew } = useFiltersAutosave(presets?.map((p) => p.name) ?? []);

  const activePreset = presets?.find((p) => p.id === activePresetId);

  async function handleDuplicate(preset: FilterPresetParsed) {
    await flush();
    // The open preset's sidebar copy may lag the draft until the list refetches.
    const config = preset.id === activePresetId ? getConfig() : preset.config;
    duplicatePreset.mutate(
      { name: `${preset.name} (copy)`, config },
      { onSuccess: (dup) => { void open(dup.id, dup.config); } },
    );
  }

  // Dashboard links here with ?preset=<id> to open that preset.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedPresetId = searchParams.get('preset');
  useEffect(() => {
    if (!linkedPresetId || !presets) return;
    setSearchParams({}, { replace: true });
    const preset = presets.find((p) => p.id === linkedPresetId);
    if (!preset || preset.id === activePresetId) return;
    void open(preset.id, preset.config);
  }, [linkedPresetId, presets, activePresetId, open, setSearchParams]);

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <EntitySidebar
        title="Presets"
        onImport={() => setShowImport(true)}
        isLoading={isLoading}
        isEmpty={!presets || presets.length === 0}
        emptyTitle="No presets saved"
        emptyDescription="Pick a mod to start a preset"
      >
        {presets?.map((preset) => (
          <PresetRow
            key={preset.id}
            preset={preset}
            active={activePresetId === preset.id}
            onSelect={() => { if (preset.id !== activePresetId) void open(preset.id, preset.config); }}
            onDuplicate={() => { void handleDuplicate(preset); }}
            onExport={() => setExportInput({ type: 'F', name: preset.name, config: preset.config })}
            onBeforeDelete={() => { if (preset.id === activePresetId) void startNew({ discard: true }); }}
          />
        ))}
      </EntitySidebar>

      {/* ── Right panel: Regex Filters editor ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {activePreset ? (
              <PresetName name={activePreset.name} onRename={(name) => updatePreset.mutate({ name })} />
            ) : (
              <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">New preset</h3>
            )}
            {STATUS_TEXT[status] && (
              <span className={`text-xs ${status === 'error' ? 'text-poe-error' : 'text-poe-text-muted'}`}>
                {STATUS_TEXT[status]}
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => { void startNew(); }}>New preset</Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <StatPicker />
        </div>
      </main>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
    </div>
  );
}
