// ABOUTME: Filters page — preset sidebar + map mod picker.
// ABOUTME: Left panel: saved presets with share codes. Right panel: avoid/prefer mod columns.

import { useState } from 'react';
import {
  useFilterPresets,
  useCreatePreset,
  useUpdatePreset,
  useDuplicatePreset,
  useDeletePreset,
  type FilterPreset,
} from '@/lib/hooks/use-filter-presets';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import { SaveEntityModal } from '@/components/ui/save-entity-modal';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { EditorToolbar } from '@/components/ui/editor-toolbar';
import { StatPicker } from '@/components/filters/stat-picker';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { useQueryClient } from '@tanstack/react-query';
import { useFiltersStore } from '@/lib/stores/filters-store';

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
    <SidebarEntityRow
      name={preset.name}
      active={active}
      onSelect={onSelect}
      onExport={onExport}
      onDuplicate={onDuplicate}
      onDelete={() => deletePreset.mutate(undefined)}
      isDeleting={deletePreset.isPending}
    />
  );
}

export function Filters() {
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportInput, setExportInput] = useState<ExportInput | null>(null);

  const { activePresetId, setActivePresetId, getConfig, loadConfig } = useFiltersStore();

  const { data: presets, isLoading } = useFilterPresets();
  const createPreset = useCreatePreset();
  const duplicatePreset = useDuplicatePreset();
  const queryClient = useQueryClient();

  // Find active preset for Save (overwrite) operation
  const activePreset = presets?.find((p) => p.id === activePresetId);

  const updatePreset = useUpdatePreset(activePresetId ?? '');

  // Detect unsaved changes by comparing current store state to saved preset config
  const currentConfig = getConfig();
  const hasUnsavedChanges = activePreset
    ? JSON.stringify(currentConfig) !== JSON.stringify(activePreset.config)
    : currentConfig.avoidModIds.length > 0 || currentConfig.preferModIds.length > 0 ||
      currentConfig.quantity !== '' || currentConfig.packSize !== '' ||
      currentConfig.rarity !== '' || currentConfig.quality !== '' ||
      currentConfig.moreCurrency !== '' || currentConfig.moreMaps !== '' ||
      currentConfig.moreScarabs !== '' || currentConfig.moreDivination !== '' ||
      currentConfig.corrupted !== 'natural' || currentConfig.isNightmareMap === true;

  function handleSaveAs(name: string) {
    const config = getConfig();
    createPreset.mutate({ name, config }, {
      onSuccess: (saved) => {
        setActivePresetId(saved.id);
        void queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      },
      onError: (err) => { console.error('[Filters] createPreset failed:', err); },
    });
  }

  function handleSaveOverwrite() {
    if (!activePresetId) return;
    const config = getConfig();
    updatePreset.mutate({ config }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      },
    });
  }

  function handleDuplicate(preset: FilterPreset) {
    duplicatePreset.mutate(
      { name: `${preset.name} (copy)`, config: preset.config },
      { onSuccess: (dup) => { setActivePresetId(dup.id); loadConfig(dup.config); } },
    );
  }

  function handleLoadPreset(preset: FilterPreset) {
    setActivePresetId(preset.id);
    loadConfig(preset.config);
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <EntitySidebar
        title="Presets"
        onImport={() => setShowImport(true)}
        isLoading={isLoading}
        isEmpty={!presets || presets.length === 0}
        emptyTitle="No presets saved"
        emptyDescription="Configure your filters and hit Save"
      >
        {presets?.map((preset) => (
          <PresetRow
            key={preset.id}
            preset={preset}
            active={activePresetId === preset.id}
            onSelect={() => handleLoadPreset(preset)}
            onDuplicate={() => handleDuplicate(preset)}
            onExport={() => setExportInput({ type: 'F', name: preset.name, config: preset.config })}
          />
        ))}
      </EntitySidebar>

      {/* ── Right panel: Map Mod Picker ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <EditorToolbar
          title="Map Mod Picker"
          hasUnsavedChanges={hasUnsavedChanges}
          hasActiveEntity={!!activePreset}
          onSave={handleSaveOverwrite}
          onSaveAs={() => setShowSaveAs(true)}
        />
        <div className="flex-1 overflow-hidden">
          <StatPicker />
        </div>
      </main>

      <SaveEntityModal
        open={showSaveAs}
        onClose={() => setShowSaveAs(false)}
        onSave={handleSaveAs}
        title="Save Preset"
        placeholder="e.g. Breach-RF, Expedition, Bow Maps..."
        label="Preset Name"
      />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
    </div>
  );
}
