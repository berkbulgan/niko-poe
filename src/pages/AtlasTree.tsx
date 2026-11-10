// ABOUTME: Atlas skill tree planner page with saved build sidebar, Canvas tree, and stats panel.
// ABOUTME: Manages allocated node state, undo history, save/load/import/share/delete operations.

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TreeRenderer } from '@/components/atlas-tree/tree-renderer';
import { StatsPanel } from '@/components/atlas-tree/stats-panel';
import {
  useAtlasTrees,
  useCreateAtlasTree,
  useDeleteAtlasTree,
  useDuplicateAtlasTree,
} from '@/lib/hooks/use-atlas-trees';
import { EditorToolbar } from '@/components/ui/editor-toolbar';
import { SaveEntityModal } from '@/components/ui/save-entity-modal';
import { SidebarEntityRow } from '@/components/ui/sidebar-entity-row';
import { EntitySidebar } from '@/components/ui/entity-sidebar';
import { ExportModal } from '@/components/ui/export-modal';
import { ImportModal } from '@/components/ui/import-modal';
import type { ExportInput } from '@/lib/hooks/use-sharing';
import { processTreeData, pruneDisconnected } from '@/lib/atlas-tree-utils';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import { useAtlasTreeStore } from '@/lib/stores/atlas-tree-store';
import { toast } from '@/lib/stores/toast-store';
import { confirmDiscard } from '@/lib/platform';
import rawTreeData from '@/data/atlas-tree-data.json';
import type {
  AtlasTreeRawData,
  AtlasTree as AtlasTreeType,
  AtlasTreeConfig,
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
}: {
  tree: AtlasTreeType;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}) {
  const deleteTree = useDeleteAtlasTree(tree.id);

  return (
    <SidebarEntityRow
      name={tree.name}
      active={active}
      onSelect={onSelect}
      onExport={onExport}
      onDuplicate={onDuplicate}
      onDelete={() => deleteTree.mutate(undefined)}
      isDeleting={deleteTree.isPending}
      subtitle={
        <span className="block text-xs text-poe-text-muted">
          {tree.config.allocatedNodeIds.length} pts
        </span>
      }
    />
  );
}

export function AtlasTree() {
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportInput, setExportInput] = useState<ExportInput | null>(null);

  const {
    activeTreeId, setActiveTreeId, allocatedIds, history, searchQuery,
    setSearchQuery, toggleNode, allocatePath, undo, reset, getConfig, loadTree,
  } = useAtlasTreeStore();

  const { data: trees, isLoading } = useAtlasTrees();
  const createTree = useCreateAtlasTree();
  const duplicateTree = useDuplicateAtlasTree();
  const queryClient = useQueryClient();

  const activeTree = trees?.find((t) => t.id === activeTreeId);

  // Detect unsaved changes by comparing current allocated nodes to saved tree
  const hasUnsavedChanges = activeTree
    ? allocatedIds.size !== activeTree.config.allocatedNodeIds.length ||
      activeTree.config.allocatedNodeIds.some((id) => !allocatedIds.has(id))
    : allocatedIds.size > 0;

  const processedNodes = useMemo(() => processTreeData(treeData), []);

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

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  // Ctrl+Z undoes the last allocation (except while typing in a field).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const handleAllocatePath = useCallback((nodeIds: number[]) => {
    allocatePath(nodeIds);
  }, [allocatePath]);

  function handleSaveAs(name: string) {
    const config = getConfig(treeData.tree);
    createTree.mutate({ name, config }, {
      onSuccess: (saved) => {
        setActiveTreeId(saved.id);
        toast.success(`Saved "${saved.name}"`);
      },
    });
  }

  const overwriteMutation = useMutation<void, Error, { config: AtlasTreeConfig }>({
    mutationFn: async ({ config }) => {
      await ipc.updateAtlasTree(activeTreeId!, { config: JSON.stringify(config) });
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['atlas-trees'] }); },
  });

  function handleSaveOverwrite() {
    if (!activeTreeId) return;
    const config = getConfig(treeData.tree);
    overwriteMutation.mutate({ config }, { onSuccess: () => toast.success('Atlas build saved') });
  }

  async function handleDuplicate(tree: AtlasTreeType) {
    if (!(await confirmDiscard(hasUnsavedChanges))) return;
    duplicateTree.mutate(
      { name: `${tree.name} (copy)`, config: tree.config },
      {
        onSuccess: (dup) => {
          loadTree(dup.id, dup.config.allocatedNodeIds);
        },
      },
    );
  }

  async function handleLoadTree(tree: AtlasTreeType) {
    if (!(await confirmDiscard(hasUnsavedChanges))) return;
    loadTree(tree.id, tree.config.allocatedNodeIds);
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      <EntitySidebar
        title="Atlas Builds"
        onImport={() => setShowImport(true)}
        isLoading={isLoading}
        isEmpty={!trees || trees.length === 0}
        emptyTitle="No builds saved"
        emptyDescription="Allocate nodes and hit Save"
      >
        {trees?.map((tree) => (
          <AtlasTreeRow
            key={tree.id}
            tree={tree}
            active={activeTreeId === tree.id}
            onSelect={() => handleLoadTree(tree)}
            onDuplicate={() => handleDuplicate(tree)}
            onExport={() => setExportInput({ type: 'A', name: tree.name, config: tree.config })}
          />
        ))}
      </EntitySidebar>

      {/* Center panel: Tree Canvas */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <EditorToolbar
          title="Atlas Skill Tree"
          hasUnsavedChanges={hasUnsavedChanges}
          hasActiveEntity={!!activeTree}
          onSave={handleSaveOverwrite}
          onSaveAs={() => setShowSaveAs(true)}
          compact
          titleExtra={
            <span className={`text-xs ${allocatedIds.size > MAX_POINTS ? 'text-poe-error font-semibold' : 'text-poe-text-muted'}`}>
              {allocatedIds.size} / {MAX_POINTS} pts
            </span>
          }
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={history.length === 0}
                title="Undo (Ctrl+Z)"
              >
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={allocatedIds.size === 0}
              >
                Reset
              </Button>
              <div className="mx-1 h-5 w-px bg-poe-border/30" />
            </>
          }
        />

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
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="bg-poe-panel/90 shadow-lg backdrop-blur-sm"
            />
          </div>
        </div>
      </main>

      {/* Right panel: Stats */}
      <StatsPanel
        allocatedNodes={allocatedNodeData}
        totalPoints={allocatedIds.size}
        maxPoints={MAX_POINTS}
      />

      <SaveEntityModal
        open={showSaveAs}
        onClose={() => setShowSaveAs(false)}
        onSave={handleSaveAs}
        title="Save Atlas Tree"
        placeholder="e.g. Essence Farming, Delirium Rush..."
        label="Build Name"
      />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={exportInput !== null} onClose={() => setExportInput(null)} input={exportInput} />
    </div>
  );
}
