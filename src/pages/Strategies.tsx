// ABOUTME: Strategies page — preset sidebar + strategy cost calculator.
// ABOUTME: Left panel: saved strategies with share codes. Right panel: strategy-builder component.

import { useState, useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import {
  useStrategies,
  useCreateStrategy,
  useDuplicateStrategy,
  useDeleteStrategy,
  useImportStrategy,
  type Strategy,
  type StrategyParsed,
} from '@/lib/hooks/use-strategies';
import {
  StrategyBuilder,
  type StrategyBuilderRef,
} from '@/components/strategies/strategy-builder';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { StrategyConfig } from '@/lib/hooks/use-strategies';
import * as ipc from '@/lib/ipc';

function SaveStrategyModal({
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
    <Modal isOpen={open} onClose={onClose} title="Save Strategy">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs text-poe-text-muted">Strategy Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Deli Scarab Blast, Legion Farming..."
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

function ImportStrategyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const importStrategy = useImportStrategy(code);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length === 8) {
      importStrategy.mutate(undefined, {
        onSuccess: () => { setCode(''); onClose(); },
      });
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Import Strategy">
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
        {importStrategy.isError && (
          <p className="text-xs text-poe-error">Strategy not found. Check the code.</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={code.length !== 8 || importStrategy.isPending}>
            {importStrategy.isPending ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StrategyRow({
  strategy,
  active,
  onSelect,
  onDuplicate,
}: {
  strategy: Strategy;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
}) {
  const deleteStrategy = useDeleteStrategy(strategy.id);

  return (
    <div className={`border-l-2 transition-all duration-100 ${active ? 'border-poe-gold bg-poe-gold/8' : 'border-transparent hover:bg-poe-panel-light/30'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-2 text-left"
      >
        <span className="block truncate text-sm text-poe-text">{strategy.name}</span>
      </button>
      {active && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <button
            onClick={onDuplicate}
            className="text-xs text-poe-text-dim hover:text-poe-gold"
          >
            Duplicate
          </button>
          <span className="text-poe-border">·</span>
          <button
            onClick={() => deleteStrategy.mutate(undefined)}
            disabled={deleteStrategy.isPending}
            className="text-xs text-poe-text-dim hover:text-poe-error"
          >
            {deleteStrategy.isPending ? '...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

export function Strategies() {
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);
  const builderRef = useRef<StrategyBuilderRef>(null);

  const { data: strategies, isLoading } = useStrategies();
  const createStrategy = useCreateStrategy();
  const duplicateStrategy = useDuplicateStrategy();
  const queryClient = useQueryClient();

  const activeStrategy = strategies?.find((s) => s.id === activeStrategyId);

  function handleSaveAs(name: string) {
    const config = builderRef.current?.getConfig();
    if (!config) return;
    createStrategy.mutate({ name, config }, {
      onSuccess: (saved) => { setActiveStrategyId(saved.id); },
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
    const config = builderRef.current?.getConfig();
    if (!config) return;
    overwriteMutation.mutate({ config });
  }

  function handleDuplicate(strategy: Strategy) {
    duplicateStrategy.mutate(
      { name: `${strategy.name} (copy)`, config: strategy.config },
      { onSuccess: (dup) => { setActiveStrategyId(dup.id); builderRef.current?.loadConfig(dup.config); } },
    );
  }

  function handleLoadStrategy(strategy: Strategy) {
    setActiveStrategyId(strategy.id);
    builderRef.current?.loadConfig(strategy.config);
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left panel: Strategies */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-poe-border/30 xl:w-72">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Strategies</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
            Import
          </Button>
        </div>

        {/* Strategy list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !strategies || strategies.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-poe-text-dim">No strategies saved</p>
              <p className="mt-1 text-xs text-poe-text-muted">
                Build your strategy and hit Save
              </p>
            </div>
          ) : (
            <div className="space-y-px p-1">
              {strategies.map((strategy) => (
                <StrategyRow
                  key={strategy.id}
                  strategy={strategy}
                  active={activeStrategyId === strategy.id}
                  onSelect={() => handleLoadStrategy(strategy)}
                  onDuplicate={() => handleDuplicate(strategy)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right panel: Strategy Builder */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">Strategy Cost Calculator</h3>
          <div className="flex gap-2">
            {activeStrategy && (
              <Button variant="ghost" size="sm" onClick={handleSaveOverwrite}>Save</Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setShowSaveAs(true)}>
              {activeStrategy ? 'Save As' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <StrategyBuilder ref={builderRef} />
        </div>
      </main>

      <SaveStrategyModal open={showSaveAs} onClose={() => setShowSaveAs(false)} onSave={handleSaveAs} />
      <ImportStrategyModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
