// ABOUTME: Atlas skill tree planner page with saved build sidebar, SVG tree canvas, and stats panel.
// ABOUTME: Manages allocated node state, undo history, save/load/import/share/delete operations.

import { useState, useMemo, useCallback, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { TreeRenderer } from '@/components/atlas-tree/tree-renderer';
import { StatsPanel } from '@/components/atlas-tree/stats-panel';
import {
  useAtlasTrees,
  useCreateAtlasTree,
  useDeleteAtlasTree,
  useDuplicateAtlasTree,
  useImportAtlasTree,
} from '@/lib/hooks/use-atlas-trees';
import { processTreeData } from '@/lib/atlas-tree-utils';
import { canDeallocate } from '@/lib/atlas-tree-utils';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import rawTreeData from '@/data/atlas-tree-data.json';
import type {
  AtlasTreeRawData,
  AtlasTree,
  AtlasTreeConfig,
  AtlasNodeData,
} from '@/types/atlas-tree';

const treeData = rawTreeData as unknown as AtlasTreeRawData;
const MAX_POINTS = treeData.points?.totalPoints ?? 138;

function SaveAtlasTreeModal({
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
    <Modal isOpen={open} onClose={onClose} title="Save Atlas Tree">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">Build Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Essence Farming, Delirium Rush..."
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

function ImportAtlasTreeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const importTree = useImportAtlasTree(code);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length === 8) {
      importTree.mutate(undefined, {
        onSuccess: () => { setCode(''); onClose(); },
      });
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Import Atlas Tree">
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
        {importTree.isError && (
          <p className="text-xs text-poe-error">Atlas tree not found. Check the code.</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={code.length !== 8 || importTree.isPending}>
            {importTree.isPending ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AtlasTreeRow({
  tree,
  active,
  onSelect,
  onDuplicate,
}: {
  tree: AtlasTree;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
}) {
  const deleteTree = useDeleteAtlasTree(tree.id);

  return (
    <div className={`border-l-2 transition-all duration-100 ${active ? 'border-poe-gold bg-poe-gold/8' : 'border-transparent hover:bg-poe-panel-light/30'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-2 text-left"
      >
        <span className="block truncate text-sm text-poe-text">{tree.name}</span>
        <span className="block text-xs text-poe-text-muted">
          {tree.config.allocatedNodeIds.length} pts
        </span>
      </button>
      {active && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <button
            onClick={onDuplicate}
            className="text-xs text-poe-text-dim hover:text-poe-gold"
          >
            Duplicate
          </button>
          <span className="text-poe-border">&middot;</span>
          <button
            onClick={() => deleteTree.mutate(undefined)}
            disabled={deleteTree.isPending}
            className="text-xs text-poe-text-dim hover:text-poe-error"
          >
            {deleteTree.isPending ? '...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

export function AtlasTree() {
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [allocatedIds, setAllocatedIds] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<ReadonlyArray<Set<number>>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: trees, isLoading } = useAtlasTrees();
  const createTree = useCreateAtlasTree();
  const duplicateTree = useDuplicateAtlasTree();
  const queryClient = useQueryClient();

  const activeTree = trees?.find((t) => t.id === activeTreeId);

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

  const pushHistory = useCallback((current: Set<number>) => {
    setHistory((prev) => [...prev.slice(-49), current]);
  }, []);

  const handleToggleNode = useCallback((nodeId: number) => {
    setAllocatedIds((prev) => {
      const next = new Set(prev);
      if (prev.has(nodeId)) {
        // Deallocate: check tree connectivity
        const stringIds = new Set(Array.from(prev).map(String));
        if (!canDeallocate(String(nodeId), stringIds, rawNodes)) {
          return prev;
        }
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      pushHistory(prev);
      return next;
    });
  }, [rawNodes, pushHistory]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setAllocatedIds(previous);
  }, [history]);

  const handleReset = useCallback(() => {
    if (allocatedIds.size === 0) return;
    pushHistory(allocatedIds);
    setAllocatedIds(new Set());
  }, [allocatedIds, pushHistory]);

  function buildConfig(): AtlasTreeConfig {
    return {
      allocatedNodeIds: Array.from(allocatedIds),
      treeVersion: treeData.tree,
    };
  }

  function handleSaveAs(name: string) {
    const config = buildConfig();
    createTree.mutate({ name, config }, {
      onSuccess: (saved) => { setActiveTreeId(saved.id); },
    });
  }

  const overwriteMutation = useMutation<AtlasTree, Error, { config: AtlasTreeConfig }>({
    mutationFn: async ({ config }) => {
      return ipc.updateAtlasTree(activeTreeId!, { config: JSON.stringify(config) }) as Promise<AtlasTree>;
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['atlas-trees'] }); },
  });

  function handleSaveOverwrite() {
    if (!activeTreeId) return;
    const config = buildConfig();
    overwriteMutation.mutate({ config });
  }

  function handleDuplicate(tree: AtlasTree) {
    duplicateTree.mutate(
      { name: `${tree.name} (copy)`, config: tree.config },
      {
        onSuccess: (dup) => {
          setActiveTreeId(dup.id);
          setAllocatedIds(new Set(dup.config.allocatedNodeIds));
          setHistory([]);
        },
      },
    );
  }

  function handleLoadTree(tree: AtlasTree) {
    setActiveTreeId(tree.id);
    setAllocatedIds(new Set(tree.config.allocatedNodeIds));
    setHistory([]);
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      {/* Left panel: Saved Builds */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-poe-border/30 xl:w-72">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Atlas Builds</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
            Import
          </Button>
        </div>

        {/* Build list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !trees || trees.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-poe-text-dim">No builds saved</p>
              <p className="mt-1 text-xs text-poe-text-muted">
                Allocate nodes and hit Save
              </p>
            </div>
          ) : (
            <div className="space-y-px p-1">
              {trees.map((tree) => (
                <AtlasTreeRow
                  key={tree.id}
                  tree={tree}
                  active={activeTreeId === tree.id}
                  onSelect={() => handleLoadTree(tree)}
                  onDuplicate={() => handleDuplicate(tree)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Center panel: Tree Canvas */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">Atlas Skill Tree</h3>
            <span className="text-xs text-poe-text-muted">
              {allocatedIds.size} / {MAX_POINTS} pts
            </span>
          </div>
          <div className="flex items-center gap-2">
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
            {activeTree && (
              <Button variant="ghost" size="sm" onClick={handleSaveOverwrite}>Save</Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setShowSaveAs(true)}>
              {activeTree ? 'Save As' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Tree renderer */}
        <div className="relative flex-1">
          <TreeRenderer
            nodes={processedNodes}
            rawNodes={rawNodes}
            allocatedIds={allocatedIds}
            onToggleNode={handleToggleNode}
            searchHighlight={searchQuery}
          />

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

      <SaveAtlasTreeModal open={showSaveAs} onClose={() => setShowSaveAs(false)} onSave={handleSaveAs} />
      <ImportAtlasTreeModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
