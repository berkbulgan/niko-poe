// ABOUTME: Modal to publish a saved strategy to the community server, or update an earlier publish.
// ABOUTME: The share code bundles the linked filter preset and atlas tree; metadata is entered here.

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { useExportEntity } from '@/lib/hooks/use-sharing';
import { useCommunityStrategy, useSavePublished } from '@/lib/hooks/use-community';
import { getPublished } from '@/lib/community-storage';
import { useLeague } from '@/lib/league-context';
import { copyToClipboard } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';
import type { StrategyParsed } from '@/lib/hooks/use-strategies';
import type { Budget, Difficulty } from '@/types/community';
import sources from '@/data/sources.json';

const NOTES_MAX = 8000;
const DEFAULT_PATCH = sources.atlasTag.split('.').slice(0, 2).join('.');

const selectClass =
  'h-10 w-full rounded-md border border-poe-border bg-poe-panel px-3 text-sm text-poe-text focus:border-poe-gold/50 focus:outline-none';

interface PublishModalProps {
  strategy: StrategyParsed | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  authorName: string;
  league: string;
  patch: string;
  tags: string;
  budget: Budget;
  difficulty: Difficulty;
  videoUrl: string;
  notes: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-poe-text-muted">{label}</span>
      {children}
    </label>
  );
}

export function PublishModal({ strategy, onClose }: PublishModalProps) {
  const { leagues, currentLeague } = useLeague();
  const published = strategy ? getPublished(strategy.id) : null;
  const existing = useCommunityStrategy(published?.communityId ?? null);
  const exportEntity = useExportEntity();
  const save = useSavePublished();
  const [form, setForm] = useState<FormState | null>(null);

  // Start from the server copy when updating, otherwise from the local strategy.
  useEffect(() => {
    if (!strategy) {
      setForm(null);
      save.reset();
      return;
    }
    if (published && existing.isPending) return;
    const d = existing.data;
    setForm({
      name: d?.name ?? strategy.name,
      authorName: d?.authorName ?? '',
      league: d?.league ?? currentLeague,
      patch: d?.patch ?? DEFAULT_PATCH,
      tags: d?.tags.join(', ') ?? '',
      budget: d?.budget ?? 'medium',
      difficulty: d?.difficulty ?? 'medium',
      videoUrl: d?.videoUrl ?? '',
      notes: d?.notes ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.id, existing.data, existing.isPending]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!strategy || !form) return;
    try {
      const shareCode = await exportEntity.mutateAsync({ type: 'S', name: form.name, config: strategy.config });
      const id = await save.mutateAsync({
        strategyId: strategy.id,
        config: strategy.config,
        request: {
          name: form.name,
          authorName: form.authorName || null,
          league: form.league,
          patch: form.patch || null,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          budget: form.budget,
          difficulty: form.difficulty,
          notes: form.notes,
          videoUrl: form.videoUrl || null,
          shareCode,
        },
      });
      const copied = await copyToClipboard(id);
      toast.success(`${published ? 'Updated' : 'Published'} as ${id}${copied ? ' (ID copied)' : ''}`);
      onClose();
    } catch {
      // Shown inline from the mutation state.
    }
  }

  const error = exportEntity.error ?? save.error;
  const busy = exportEntity.isPending || save.isPending;

  return (
    <Modal
      isOpen={strategy !== null}
      onClose={onClose}
      title={published ? 'Update Published Strategy' : 'Publish Strategy'}
      className="max-w-2xl"
    >
      {!form ? (
        <p className="text-sm text-poe-text-muted">
          {existing.isError ? `Could not load the published copy: ${existing.error.message}` : 'Loading...'}
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <p className="text-xs text-poe-text-muted">
            Publishes the saved version of this strategy, including its linked filter preset and atlas tree.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Author (optional)">
              <Input value={form.authorName} onChange={(e) => update('authorName', e.target.value)} maxLength={40} />
            </Field>
            <Field label="League">
              <select className={selectClass} value={form.league} onChange={(e) => update('league', e.target.value)}>
                {!leagues.some((l) => l.id === form.league) && <option value={form.league}>{form.league}</option>}
                {leagues.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
              </select>
            </Field>
            <Field label="Patch">
              <Input value={form.patch} onChange={(e) => update('patch', e.target.value)} maxLength={16} />
            </Field>
            <Field label="Budget">
              <select className={selectClass} value={form.budget} onChange={(e) => update('budget', e.target.value as Budget)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Difficulty">
              <select className={selectClass} value={form.difficulty} onChange={(e) => update('difficulty', e.target.value as Difficulty)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
          </div>
          <Field label="Tags (comma separated, up to 5)">
            <Input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="delirium, strongbox" />
          </Field>
          <Field label="Video link (optional)">
            <Input value={form.videoUrl} onChange={(e) => update('videoUrl', e.target.value)} placeholder="https://" maxLength={300} />
          </Field>
          <div>
            <span className="mb-1 block text-xs text-poe-text-muted">Notes (markdown)</span>
            <MarkdownEditor
              value={form.notes}
              onChange={(v) => update('notes', v)}
              maxLength={NOTES_MAX}
              placeholder="Map choice, scarab slots, build requirements, how to run it..."
            />
          </div>

          {error && <p className="text-xs text-poe-error">{error.message}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Publishing...' : published ? 'Update' : 'Publish'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
