// ABOUTME: Modal for creating or editing a snapshot config (tab selection + strategy link).
// ABOUTME: Reuses stash tab list with checkboxes for multi-select.

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStrategies } from '@/lib/hooks/use-strategies';
import type { StashTab } from '@/types/index';
import type { SnapshotConfig } from '@/types/snapshots';

interface SnapshotConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; tabIds: string[]; strategyId: string | null }) => Promise<void>;
  tabs: StashTab[];
  existing?: SnapshotConfig | null;
}

export function SnapshotConfigModal({
  open,
  onClose,
  onSave,
  tabs,
  existing,
}: SnapshotConfigModalProps) {
  const [name, setName] = useState('');
  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set());
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: strategies } = useStrategies();

  useEffect(() => {
    if (open) {
      if (existing) {
        setName(existing.name);
        setSelectedTabs(new Set(existing.tabIds));
        setStrategyId(existing.strategyId);
      } else {
        setName('');
        setSelectedTabs(new Set());
        setStrategyId(null);
      }
    }
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleTab(tabId: string) {
    setSelectedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (name.trim() === '' || selectedTabs.size === 0 || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), tabIds: Array.from(selectedTabs), strategyId });
    } catch {
      // Shown as a toast by the global mutation error handler; keep the modal open.
    } finally {
      setSaving(false);
    }
  }

  const flatTabs = flattenTabs(tabs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div role="dialog" aria-modal="true" aria-label={existing ? 'Edit Config' : 'New Snapshot Config'} className="w-full max-w-md border border-poe-border/40 bg-poe-bg p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm tracking-wide text-poe-text">
            {existing ? 'Edit Config' : 'New Snapshot Config'}
          </h3>
          <button type="button" onClick={onClose} className="text-poe-text-muted hover:text-poe-text" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1 block text-xs text-poe-text-muted">Config Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dump Tabs, Currency Only"
            className="w-full border border-poe-border/40 bg-poe-panel/30 px-3 py-2 text-sm text-poe-text placeholder:text-poe-text-muted/40 focus:border-poe-gold/50 focus:outline-none"
          />
        </div>

        {/* Tab selection */}
        <div className="mb-4">
          <label className="mb-1 block text-xs text-poe-text-muted">
            Select Stash Tabs ({selectedTabs.size} selected)
          </label>
          <div className="max-h-48 overflow-y-auto border border-poe-border/30 bg-poe-panel/20">
            {flatTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => toggleTab(tab.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  selectedTabs.has(tab.id)
                    ? 'bg-poe-gold/8 text-poe-gold'
                    : 'text-poe-text-dim hover:bg-poe-panel-light/20'
                }`}
                style={{ paddingLeft: `${12 + tab.depth * 16}px` }}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center border text-xs ${
                  selectedTabs.has(tab.id)
                    ? 'border-poe-gold/60 bg-poe-gold/20'
                    : 'border-poe-border/40'
                }`}>
                  {selectedTabs.has(tab.id) && <Check size={10} />}
                </span>
                <span className="truncate">{tab.name}</span>
                <span className="ml-auto text-[10px] text-poe-text-muted">{tab.stashType}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Strategy link */}
        <div className="mb-6">
          <label className="mb-1 block text-xs text-poe-text-muted">
            Link to Strategy (optional — enables ROI tracking)
          </label>
          <select
            value={strategyId ?? ''}
            onChange={(e) => setStrategyId(e.target.value || null)}
            className="w-full border border-poe-border/40 bg-poe-panel/30 px-3 py-2 text-sm text-poe-text focus:border-poe-gold/50 focus:outline-none"
          >
            <option value="">None</option>
            {(strategies ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { void handleSubmit(); }}
            disabled={name.trim() === '' || selectedTabs.size === 0 || saving}
          >
            {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface FlatTab {
  id: string;
  name: string;
  stashType: string;
  depth: number;
}

function flattenTabs(tabs: StashTab[], depth = 0): FlatTab[] {
  const result: FlatTab[] = [];
  for (const tab of tabs) {
    const isFolder = tab.stashType === 'Folder' || tab.children.length > 0;
    if (isFolder) {
      // Show folder as header, children as selectable items
      result.push({ id: tab.id, name: tab.name, stashType: 'Folder', depth });
      result.push(...flattenTabs(tab.children, depth + 1));
    } else {
      result.push({ id: tab.id, name: tab.name, stashType: tab.stashType, depth });
    }
  }
  return result;
}
