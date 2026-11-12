// ABOUTME: Regex Filters page — preset sidebar + map mod picker, autosaved.
// ABOUTME: Toolbar shows the open preset's editable name, save status and a New preset button.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useFilterPresets,
  useUpdatePreset,
  useDuplicatePreset,
  useDeletePreset,
  type FilterPresetParsed,
} from '@/lib/hooks/use-filter-presets';
import { useFiltersAutosave } from '@/lib/hooks/use-filters-autosave';
import { useStrategiesUsing } from '@/lib/hooks/use-strategies';
import { UsedInLinks } from '@/components/ui/used-in-links';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { Button } from '@/components/ui/button';
import { EntityTitle } from '@/components/ui/entity-title';
import { StatPicker } from '@/components/filters/stat-picker';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { useFiltersStore } from '@/lib/stores/filters-store';
import { useGameDataStore } from '@/lib/stores/game-data-store';

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
  const usedIn = useStrategiesUsing('filterPresetId', preset.id);

  return (
    <SidebarEntityRow
      name={preset.name}
      active={active}
      onSelect={onSelect}
      onExport={onExport}
      onDuplicate={onDuplicate}
      onDelete={() => { onBeforeDelete(); deletePreset.mutate(undefined); }}
      isDeleting={deletePreset.isPending}
      extra={usedIn.length > 0 && <UsedInLinks strategies={usedIn} />}
    />
  );
}

export function Filters() {
  const [showImport, setShowImport] = useState(false);
  const [exportInput, setExportInput] = useState<ExportInput | null>(null);
  // New map mod data remounts the picker so its memoized lists and regex use it.
  const gameDataVersion = useGameDataStore((s) => s.version);

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

  async function handleExport(preset: FilterPresetParsed) {
    await flush();
    const config = preset.id === activePresetId ? getConfig() : preset.config;
    setExportInput({ type: 'F', name: preset.name, config });
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
            onExport={() => { void handleExport(preset); }}
            onBeforeDelete={() => { if (preset.id === activePresetId) void startNew({ discard: true }); }}
          />
        ))}
      </EntitySidebar>

      {/* ── Right panel: Regex Filters editor ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <EntityTitle
            name={activePreset?.name ?? null}
            placeholder="New preset"
            onRename={(name) => updatePreset.mutate({ name })}
            status={status}
            ariaLabel="Preset name"
          />
          <Button variant="secondary" size="sm" onClick={() => { void startNew(); }}>New preset</Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <StatPicker key={gameDataVersion} />
        </div>
      </main>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
    </div>
  );
}
