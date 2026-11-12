// ABOUTME: Atlas skill tree planner page with saved atlas tree sidebar, Canvas tree, and stats panel.
// ABOUTME: Autosaves the open tree (or an "Untitled tree" on the first allocation); undo, rename, import/export, ?tree= links.

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
} from '@/lib/hooks/use-atlas-trees';
import { useAtlasAutosave } from '@/lib/hooks/use-atlas-autosave';
import { useStrategiesUsing } from '@/lib/hooks/use-strategies';
import { UsedInLinks } from '@/components/ui/used-in-links';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { nodeMechanics, processTreeData, pruneDisconnected } from '@/lib/atlas-tree-utils';
import { useAtlasTreeStore } from '@/lib/stores/atlas-tree-store';
import { useConfirmStore } from '@/lib/stores/confirm-store';
import rawTreeData from '@/data/atlas-tree-data.json';
import type {
  AtlasTreeRawData,
  AtlasTree as AtlasTreeType,
  AtlasNodeData,
} from '@/types/atlas-tree';

const treeData = rawTreeData as unknown as AtlasTreeRawData;
const MAX_POINTS = treeData.points?.totalPoints ?? 138;

function AtlasTreeRow({
  tree,
  active,
  onSelect,
  onDuplicate,
  onExport,
  onBeforeDelete,
}: {
  tree: AtlasTreeType;
  active: boolean;
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
  const { status, flush, open, startNew } = useAtlasAutosave(trees?.map((t) => t.name) ?? []);

  const activeTree = trees?.find((t) => t.id === activeTreeId);

  const processedNodes = useMemo(() => processTreeData(treeData), []);
  const mechanics = useMemo(() => nodeMechanics(treeData.nodes), []);
  const jumpTargets = useMemo(() => {
    const byMechanic = new Map<string, string[]>();
    for (const [nodeId, mechanic] of mechanics) {
      const ids = byMechanic.get(mechanic);
      if (ids) ids.push(nodeId);
      else byMechanic.set(mechanic, [nodeId]);
    }
    return Array.from(byMechanic, ([label, nodeIds]) => ({ label, nodeIds }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mechanics]);

  const rawNodes = treeData.nodes;

  const allocatedNodeData = useMemo(() => {
    const result: AtlasNodeData[] = [];
    for (const id of allocatedIds) {
      const node = rawNodes[String(id)];
      if (node) result.push(node);
    }
    return result;
  }, [allocatedIds, rawNodes]);

  // Bounds from GGG data
  const bounds = useMemo(() => ({
    minX: treeData.min_x,
    minY: treeData.min_y,
    maxX: treeData.max_x,
    maxY: treeData.max_y,
  }), []);

  const handleToggleNode = useCallback((nodeId: number) => {
    toggleNode(nodeId, rawNodes, pruneDisconnected);
  }, [rawNodes, toggleNode]);

  // Ctrl+Z undoes the last allocation (except while typing in a field).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (useConfirmStore.getState().request !== null) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  const handleAllocatePath = useCallback((nodeIds: number[]) => {
    allocatePath(nodeIds);
  }, [allocatePath]);

  async function handleDuplicate(tree: AtlasTreeType) {
    await flush();
    // The open tree's sidebar copy may lag the draft until the list refetches.
    const config = tree.id === activeTreeId ? getConfig(treeData.tree) : tree.config;
    duplicateTree.mutate(
      { name: `${tree.name} (copy)`, config },
      { onSuccess: (dup) => { void open(dup.id, dup.config); } },
    );
  }

  async function handleExport(tree: AtlasTreeType) {
    await flush();
    const config = tree.id === activeTreeId ? getConfig(treeData.tree) : tree.config;
    setExportInput({ type: 'A', name: tree.name, config });
  }

  // Strategies link here with ?tree=<id> to open that tree.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedTreeId = searchParams.get('tree');
  useEffect(() => {
    if (!linkedTreeId || !trees) return;
    setSearchParams({}, { replace: true });
    const tree = trees.find((t) => t.id === linkedTreeId);
    if (!tree || tree.id === activeTreeId) return;
    void open(tree.id, tree.config);
  }, [linkedTreeId, trees, activeTreeId, open, setSearchParams]);

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
            onSelect={() => { if (tree.id !== activeTreeId) void open(tree.id, tree.config); }}
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
            <span className={`text-xs ${allocatedIds.size > MAX_POINTS ? 'font-semibold text-poe-error' : 'text-poe-text-muted'}`}>
              {allocatedIds.size} / {MAX_POINTS} pts
            </span>
          </EntityTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => undo()}
              disabled={history.length === 0}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { void startNew(); }}>New tree</Button>
          </div>
        </div>

        {/* Tree renderer */}
        <div className="relative flex-1">
          <TreeRenderer
            nodes={processedNodes}
            rawNodes={rawNodes}
            allocatedIds={allocatedIds}
            onToggleNode={handleToggleNode}
            onAllocatePath={handleAllocatePath}
            searchHighlight={searchQuery}
            sprites={treeData.sprites}
            imageZoomLevels={treeData.imageZoomLevels}
            bounds={bounds}
            groups={treeData.groups}
            focus={focus}
            jumpTargets={jumpTargets}
          />

          {/* Over-limit toast */}
          {allocatedIds.size > MAX_POINTS && (
            <div className="absolute right-4 top-4 rounded border border-poe-error/40 bg-poe-panel/95 px-4 py-2 shadow-lg backdrop-blur-sm">
              <p className="text-sm font-semibold text-poe-error">
                {allocatedIds.size - MAX_POINTS} point{allocatedIds.size - MAX_POINTS > 1 ? 's' : ''} over limit
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
        maxPoints={MAX_POINTS}
        mechanics={mechanics}
        treeName={activeTree?.name ?? 'Atlas tree'}
        onFocusNode={focusNode}
      />

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
    </div>
  );
}
