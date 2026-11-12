// ABOUTME: Atlas skill tree planner page with saved atlas tree sidebar, Canvas tree, and stats panel.
// ABOUTME: Autosaves the open tree; a tree saved on another atlas patch opens read-only until Update migrates it.

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EntityTitle } from '@/components/ui/entity-title';
import { TreeRenderer } from '@/components/atlas-tree/tree-renderer';
import { StatsPanel } from '@/components/atlas-tree/stats-panel';
import { AtlasSearch } from '@/components/atlas-tree/atlas-search';
import {
  useAtlasTrees,
  useDeleteAtlasTree,
  useDuplicateAtlasTree,
  useRenameAtlasTree,
  useSaveAtlasTreeConfig,
} from '@/lib/hooks/use-atlas-trees';
import { useAtlasAutosave } from '@/lib/hooks/use-atlas-autosave';
import { useStrategiesUsing } from '@/lib/hooks/use-strategies';
import { UsedInLinks } from '@/components/ui/used-in-links';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { mechanicCoreNodeIds, migrateTree, nodeMechanics, pruneDisconnected, resolveTreeTag } from '@/lib/atlas-tree-utils';
import { useAtlasData, useAtlasVersions, useTreeAtlas } from '@/lib/atlas-data';
import { useAtlasTreeStore } from '@/lib/stores/atlas-tree-store';
import { useConfirmStore } from '@/lib/stores/confirm-store';
import { useGameDataStore } from '@/lib/stores/game-data-store';
import { toast } from '@/lib/stores/toast-store';
import type {
  AtlasTree as AtlasTreeType,
  AtlasNodeData,
  AtlasTreeConfig,
} from '@/types/atlas-tree';

/** Used when a data.json has no points block. */
const DEFAULT_MAX_POINTS = 138;

function AtlasTreeRow({
  tree,
  active,
  badge,
  onSelect,
  onDuplicate,
  onExport,
  onBeforeDelete,
}: {
  tree: AtlasTreeType;
  active: boolean;
  /** The tree's atlas tag (or "old") when it is not the current tag. */
  badge: string | null;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onBeforeDelete: () => void;
}) {
  const deleteTree = useDeleteAtlasTree(tree.id);
  const usedIn = useStrategiesUsing('atlasTreeId', tree.id);

  return (
    <SidebarEntityRow
      name={tree.name}
      active={active}
      onSelect={onSelect}
      onExport={onExport}
      onDuplicate={onDuplicate}
      onDelete={() => { onBeforeDelete(); deleteTree.mutate(undefined); }}
      isDeleting={deleteTree.isPending}
      subtitle={
        <span className="block truncate text-xs text-poe-text-muted">
          {tree.config.allocatedNodeIds.length} pts
          {badge && (
            <span className="ml-1.5 rounded border border-poe-border/30 px-1 text-[10px] text-poe-text-muted">{badge}</span>
          )}
        </span>
      }
      extra={usedIn.length > 0 && <UsedInLinks strategies={usedIn} />}
    />
  );
}

export function AtlasTree() {
  const [showImport, setShowImport] = useState(false);
  const [exportInput, setExportInput] = useState<ExportInput | null>(null);
  // A new object re-centers the tree on that node (search cycling, stats panel clicks).
  const [focus, setFocus] = useState<{ nodeId: string } | null>(null);
  const focusNode = (nodeId: string) => setFocus({ nodeId });

  const {
    activeTreeId, allocatedIds, history, searchQuery,
    setSearchQuery, toggleNode, allocatePath, undo, getConfig,
  } = useAtlasTreeStore();

  const { data: trees, isLoading } = useAtlasTrees();
  const duplicateTree = useDuplicateAtlasTree();
  const renameTree = useRenameAtlasTree();
  const saveConfig = useSaveAtlasTreeConfig();
  const { status, flush, open, startNew } = useAtlasAutosave(trees?.map((t) => t.name) ?? []);

  const activeTree = trees?.find((t) => t.id === activeTreeId);

  // A tree saved on another atlas patch (null: an unknown older one) is read-only until it is updated.
  const currentTag = useGameDataStore((s) => s.atlasTag);
  const versions = useAtlasVersions();
  const activeTag = activeTree ? resolveTreeTag(activeTree, versions) : currentTag;
  const readOnly = activeTag !== currentTag;
  const atlas = useTreeAtlas(activeTag);
  const { data: currentAtlas } = useAtlasData(currentTag);

  const treeData = atlas?.data;
  const maxPoints = treeData?.points?.totalPoints ?? DEFAULT_MAX_POINTS;
  const processedNodes = useMemo(() => atlas?.nodes ?? [], [atlas]);
  const rawNodes = useMemo<Record<string, AtlasNodeData>>(() => treeData?.nodes ?? {}, [treeData]);
  const mechanics = useMemo(() => nodeMechanics(rawNodes), [rawNodes]);
  const jumpTargets = useMemo(
    () => Array.from(mechanicCoreNodeIds(rawNodes), ([label, nodeIds]) => ({ label, nodeIds }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [rawNodes],
  );

  const allocatedNodeData = useMemo(() => {
    const result: AtlasNodeData[] = [];
    for (const id of allocatedIds) {
      const node = rawNodes[String(id)];
      if (node) result.push(node);
    }
    return result;
  }, [allocatedIds, rawNodes]);

  // Bounds from GGG data
  const bounds = useMemo(() => (treeData ? {
    minX: treeData.min_x,
    minY: treeData.min_y,
    maxX: treeData.max_x,
    maxY: treeData.max_y,
  } : null), [treeData]);

  const handleToggleNode = useCallback((nodeId: number) => {
    toggleNode(nodeId, rawNodes, pruneDisconnected);
  }, [rawNodes, toggleNode]);

  // Ctrl+Z undoes the last allocation (except while typing in a field, or on a read-only tree).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (useConfirmStore.getState().request !== null) return;
      if (readOnly) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo, readOnly]);

  const handleAllocatePath = useCallback((nodeIds: number[]) => {
    allocatePath(nodeIds);
  }, [allocatePath]);

  /** Sidebar badge for a tree on another patch: its tag, or "old" when the patch is unknown. */
  function badgeFor(tree: AtlasTreeType): string | null {
    const tag = resolveTreeTag(tree, versions);
    return tag === currentTag ? null : (tag ?? 'old');
  }

  // The open tree's sidebar copy may lag the draft until the list refetches; other trees keep their own patch tag.
  function configFor(tree: AtlasTreeType): AtlasTreeConfig {
    if (tree.id === activeTreeId && !readOnly) return getConfig();
    return { ...tree.config, treeVersion: resolveTreeTag(tree, versions) ?? tree.config.treeVersion };
  }

  async function handleDuplicate(tree: AtlasTreeType) {
    await flush();
    duplicateTree.mutate(
      { name: `${tree.name} (copy)`, config: configFor(tree) },
      { onSuccess: (dup) => { void open(dup.id, dup.config); } },
    );
  }

  async function handleExport(tree: AtlasTreeType) {
    await flush();
    setExportInput({ type: 'A', name: tree.name, config: configFor(tree) });
  }

  function handleUpdate() {
    if (!activeTree || !currentAtlas) return;
    const { kept, removed } = migrateTree(activeTree.config.allocatedNodeIds, currentAtlas.data.nodes);
    const config: AtlasTreeConfig = { allocatedNodeIds: kept, treeVersion: currentTag };
    // Saved directly: autosave compares node ids only, so an update that keeps every node would never be written.
    saveConfig.mutate({ id: activeTree.id, config }, {
      onSuccess: () => {
        void open(activeTree.id, config);
        toast.success(`Updated to ${currentTag}: kept ${kept.length} nodes, removed ${removed.length}`);
      },
      onError: () => toast.error('Could not update atlas tree'),
    });
  }

  // Strategies link here with ?tree=<id> to open that tree.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedTreeId = searchParams.get('tree');
  useEffect(() => {
    if (!linkedTreeId || !trees) return;
    setSearchParams({}, { replace: true });
    const tree = trees.find((t) => t.id === linkedTreeId);
    if (!tree || tree.id === activeTreeId) return;
    void open(tree.id, { ...tree.config, treeVersion: resolveTreeTag(tree, versions) ?? tree.config.treeVersion });
  }, [linkedTreeId, trees, activeTreeId, open, setSearchParams, versions]);

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <EntitySidebar
        title="Atlas Trees"
        onImport={() => setShowImport(true)}
        isLoading={isLoading}
        isEmpty={!trees || trees.length === 0}
        emptyTitle="No atlas trees saved"
        emptyDescription="Allocate a node to start a tree"
      >
        {trees?.map((tree) => (
          <AtlasTreeRow
            key={tree.id}
            tree={tree}
            active={activeTreeId === tree.id}
            badge={badgeFor(tree)}
            onSelect={() => { if (tree.id !== activeTreeId) void open(tree.id, configFor(tree)); }}
            onDuplicate={() => { void handleDuplicate(tree); }}
            onExport={() => { void handleExport(tree); }}
            onBeforeDelete={() => { if (tree.id === activeTreeId) void startNew({ discard: true }); }}
          />
        ))}
      </EntitySidebar>

      {/* Center panel: Tree Canvas */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <EntityTitle
            name={activeTree?.name ?? null}
            placeholder="New tree"
            onRename={(name) => { if (activeTreeId) renameTree.mutate({ id: activeTreeId, name }); }}
            status={status}
            ariaLabel="Atlas tree name"
          >
            <span className={`text-xs ${allocatedIds.size > maxPoints ? 'font-semibold text-poe-error' : 'text-poe-text-muted'}`}>
              {allocatedIds.size} / {maxPoints} pts
            </span>
          </EntityTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => undo()}
              disabled={readOnly || history.length === 0}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { void startNew(); }}>New tree</Button>
          </div>
        </div>

        {/* Old patch: read-only until updated */}
        {readOnly && atlas && (
          <div className="flex items-center justify-between gap-3 border-b border-poe-gold/20 bg-poe-gold/5 px-4 py-2 lg:px-6">
            <p className="text-xs text-poe-gold">
              {atlas.tag === activeTag
                ? `Made for ${activeTag}. Update it to ${currentTag} to edit.`
                : 'Made for an older patch.'}
            </p>
            <Button size="sm" onClick={handleUpdate} disabled={!currentAtlas || saveConfig.isPending}>
              Update
            </Button>
          </div>
        )}

        {/* Tree renderer */}
        <div className="relative flex-1">
          {atlas && bounds ? (
            <TreeRenderer
              key={atlas.tag}
              nodes={processedNodes}
              rawNodes={rawNodes}
              allocatedIds={allocatedIds}
              onToggleNode={handleToggleNode}
              onAllocatePath={handleAllocatePath}
              searchHighlight={searchQuery}
              sprites={atlas.data.sprites}
              imageZoomLevels={atlas.data.imageZoomLevels}
              assetUrl={atlas.assetUrl}
              bounds={bounds}
              groups={atlas.data.groups}
              focus={focus}
              jumpTargets={jumpTargets}
              readOnly={readOnly}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-poe-text-muted">Loading atlas tree…</div>
          )}

          {/* Over-limit toast */}
          {allocatedIds.size > maxPoints && (
            <div className="absolute right-4 top-4 rounded border border-poe-error/40 bg-poe-panel/95 px-4 py-2 shadow-lg backdrop-blur-sm">
              <p className="text-sm font-semibold text-poe-error">
                {allocatedIds.size - maxPoints} point{allocatedIds.size - maxPoints > 1 ? 's' : ''} over limit
              </p>
            </div>
          )}

          {/* Search bar overlay at bottom */}
          <div className="absolute bottom-4 left-1/2 w-80 -translate-x-1/2">
            <AtlasSearch
              nodes={processedNodes}
              query={searchQuery}
              // A new or cleared query drops the old match's focus highlight.
              onQueryChange={(query) => { setSearchQuery(query); setFocus(null); }}
              onFocusNode={focusNode}
            />
          </div>
        </div>
      </main>

      {/* Right panel: Stats */}
      <StatsPanel
        allocatedNodes={allocatedNodeData}
        totalPoints={allocatedIds.size}
        maxPoints={maxPoints}
        mechanics={mechanics}
        treeName={activeTree?.name ?? 'Atlas tree'}
        onFocusNode={focusNode}
      />

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
    </div>
  );
}
