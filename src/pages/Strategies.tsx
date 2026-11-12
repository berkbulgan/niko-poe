// ABOUTME: Strategies page — preset sidebar + strategy cost calculator.
// ABOUTME: Left panel: saved strategies with share codes. Right panel: strategy-builder component.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useStrategies,
  useCreateStrategy,
  useDuplicateStrategy,
  useDeleteStrategy,
  type StrategyParsed,
} from '@/lib/hooks/use-strategies';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import { SaveEntityModal } from '@/components/ui/save-entity-modal';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { EditorToolbar } from '@/components/ui/editor-toolbar';
import { StrategyBuilder } from '@/components/strategies/strategy-builder';
import { StrategyResults } from '@/components/strategies/strategy-results';
import { PublishModal } from '@/components/strategies/publish-modal';
import { PublishBadge, usePublishState } from '@/components/strategies/publish-badge';
import { Button } from '@/components/ui/button';
import { useUnpublish } from '@/lib/hooks/use-community';
import { getPublished } from '@/lib/community-storage';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { StrategyConfig } from '@/lib/hooks/use-strategies';
import * as ipc from '@/lib/ipc';
import { useStrategiesStore } from '@/lib/stores/strategies-store';
import { toast } from '@/lib/stores/toast-store';
import { confirmAction, confirmDiscard } from '@/lib/platform';
import { MAPS_PER_USE } from '@/lib/strategy-cost';

function StrategyRow({
  strategy,
  active,
  onSelect,
  onDuplicate,
  onExport,
  onDeleted,
}: {
  strategy: StrategyParsed;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDeleted: () => void;
}) {
  const deleteStrategy = useDeleteStrategy(strategy.id);
  const publishState = usePublishState(strategy);
  const published = getPublished(strategy.id) !== null;

  return (
    <SidebarEntityRow
      name={strategy.name}
      active={active}
      onSelect={onSelect}
      onExport={onExport}
      onDuplicate={onDuplicate}
      // mutateAsync: the row unmounts once the list refetches, which would drop a mutate() callback.
      onDelete={() => { deleteStrategy.mutateAsync().then(onDeleted, () => { /* toasted by the query client */ }); }}
      isDeleting={deleteStrategy.isPending}
      deleteDescription={published
        ? "It is also removed from the community list. This can't be undone."
        : undefined}
      subtitle={<PublishBadge state={publishState} />}
    />
  );
}

/** Toolbar badge; a component so the hook only runs while a strategy is open. */
function ActivePublishBadge({ strategy }: { strategy: StrategyParsed }) {
  return <PublishBadge state={usePublishState(strategy)} />;
}


export function Strategies() {
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportInput, setExportInput] = useState<ExportInput | null>(null);
  const [publishTarget, setPublishTarget] = useState<StrategyParsed | null>(null);
  const unpublish = useUnpublish();
  const navigate = useNavigate();

  const { activeStrategyId, setActiveStrategyId, getConfig, loadConfig } = useStrategiesStore();

  const { data: strategies, isLoading } = useStrategies();
  const createStrategy = useCreateStrategy();
  const duplicateStrategy = useDuplicateStrategy();
  const queryClient = useQueryClient();

  const activeStrategy = strategies?.find((s) => s.id === activeStrategyId);

  // Detect unsaved changes by comparing current store state to saved strategy config
  const currentConfig = getConfig();
  const hasUnsavedChanges = activeStrategy
    ? JSON.stringify(currentConfig) !== JSON.stringify(activeStrategy.config)
    : currentConfig.items.length > 0 || currentConfig.averageMapCost !== 0 ||
      currentConfig.filterPresetId !== null || currentConfig.atlasTreeId !== null;

  function handleSaveAs(name: string) {
    const config = getConfig();
    createStrategy.mutate({ name, config }, {
      onSuccess: (saved) => {
        setActiveStrategyId(saved.id);
        void queryClient.invalidateQueries({ queryKey: ['strategies'] });
        toast.success(`Saved "${saved.name}"`);
      },
      onError: (err) => { console.error('[Strategies] createStrategy failed:', err); },
    });
  }

  const overwriteMutation = useMutation<StrategyParsed, Error, { config: StrategyConfig }>({
    mutationFn: async ({ config }) => {
      const strategy = await ipc.updateStrategy(activeStrategyId!, { config: JSON.stringify(config) });
      return { ...strategy, config: JSON.parse(strategy.config) as StrategyConfig };
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['strategies'] }); },
  });

  function handleSaveOverwrite() {
    if (!activeStrategyId) return;
    const config = getConfig();
    overwriteMutation.mutate({ config }, { onSuccess: () => toast.success(`Saved "${activeStrategy?.name ?? 'strategy'}"`) });
  }

  async function handleDuplicate(strategy: StrategyParsed) {
    if (!(await confirmDiscard(hasUnsavedChanges))) return;
    duplicateStrategy.mutate(
      { name: `${strategy.name} (copy)`, config: strategy.config },
      { onSuccess: (dup) => { setActiveStrategyId(dup.id); loadConfig(dup.config, MAPS_PER_USE); } },
    );
  }

  const published = activeStrategy ? getPublished(activeStrategy.id) : null;

  async function handleUnpublish() {
    if (!activeStrategy) return;
    const ok = await confirmAction(`Remove "${activeStrategy.name}" from the community list?`, {
      confirmLabel: 'Unpublish',
      destructive: true,
    });
    if (!ok) return;
    unpublish.mutate(activeStrategy.id, { onSuccess: () => toast.success('Strategy unpublished') });
  }

  async function handleLoadStrategy(strategy: StrategyParsed) {
    if (!(await confirmDiscard(hasUnsavedChanges))) return;
    setActiveStrategyId(strategy.id);
    loadConfig(strategy.config, MAPS_PER_USE);
  }

  // Preset/tree cards and Community link here with ?strategy=<id> to open that strategy.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedStrategyId = searchParams.get('strategy');
  useEffect(() => {
    if (!linkedStrategyId || !strategies) return;
    setSearchParams({}, { replace: true });
    const strategy = strategies.find((s) => s.id === linkedStrategyId);
    if (!strategy || strategy.id === activeStrategyId) return;
    void handleLoadStrategy(strategy);
  // handleLoadStrategy is recreated every render; the param is cleared first, so this runs once per link.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedStrategyId, strategies, activeStrategyId, setSearchParams]);

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <EntitySidebar
        title="Strategies"
        onImport={() => setShowImport(true)}
        isLoading={isLoading}
        isEmpty={!strategies || strategies.length === 0}
        emptyTitle="No strategies saved"
        emptyDescription="Build your strategy and hit Save"
      >
        {strategies?.map((strategy) => (
          <StrategyRow
            key={strategy.id}
            strategy={strategy}
            active={activeStrategyId === strategy.id}
            onSelect={() => handleLoadStrategy(strategy)}
            onDuplicate={() => handleDuplicate(strategy)}
            onExport={() => setExportInput({ type: 'S', name: strategy.name, config: strategy.config })}
            onDeleted={() => {
              // Deleting the open strategy starts an empty draft, as on Filters and Atlas Tree.
              if (useStrategiesStore.getState().activeStrategyId === strategy.id) {
                useStrategiesStore.setState(useStrategiesStore.getInitialState());
              }
            }}
          />
        ))}
      </EntitySidebar>

      {/* Right panel: Strategy Builder */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <EditorToolbar
          title="Strategy Cost Calculator"
          titleExtra={activeStrategy && <ActivePublishBadge strategy={activeStrategy} />}
          hasUnsavedChanges={hasUnsavedChanges}
          hasActiveEntity={!!activeStrategy}
          onSave={handleSaveOverwrite}
          onSaveAs={() => setShowSaveAs(true)}
          actions={activeStrategy && (
            <>
              {published && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleUnpublish} disabled={unpublish.isPending}>
                    Unpublish
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/community?id=${published.communityId}`)}>
                    View in Community
                  </Button>
                </>
              )}
              <Button variant="secondary" size="sm" onClick={() => setPublishTarget(activeStrategy)}>
                {published ? 'Update Published' : 'Publish'}
              </Button>
            </>
          )}
        />
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <StrategyBuilder />
          {activeStrategy && <StrategyResults strategyId={activeStrategy.id} />}
        </div>
      </main>

      <SaveEntityModal
        open={showSaveAs}
        onClose={() => setShowSaveAs(false)}
        onSave={handleSaveAs}
        title="Save Strategy"
        placeholder="e.g. Deli Scarab Blast, Legion Farming..."
        label="Strategy Name"
      />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
      <PublishModal strategy={publishTarget} onClose={() => setPublishTarget(null)} />
    </div>
  );
}
