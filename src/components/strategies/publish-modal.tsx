// ABOUTME: Modal to publish a saved strategy to the community server, or update an earlier publish.
// ABOUTME: The share code bundles the linked filter preset and atlas tree; name, author, tags and notes are entered here.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { SimpleSelect } from '@/components/ui/select';
import { useExportEntity } from '@/lib/hooks/use-sharing';
import { useCommunityStrategy, useCommunityTags, useSavePublished } from '@/lib/hooks/use-community';
import { useFilterPresets } from '@/lib/hooks/use-filter-presets';
import { useAtlasTrees } from '@/lib/hooks/use-atlas-trees';
import { getPublished } from '@/lib/community-storage';
import { useLeague } from '@/lib/league-context';
import { storage } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';
import { useGameDataStore } from '@/lib/stores/game-data-store';
import { MAX_TAGS, TAG_RULE, isValidTag, normalizeTags } from '@/lib/tags';
import type { StrategyParsed } from '@/lib/hooks/use-strategies';
import type { Budget, Difficulty } from '@/types/community';

const NOTES_MAX = 8000;
const AUTHOR_KEY = 'niko_community_author';

interface PublishModalProps {
  strategy: StrategyParsed | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  authorName: string;
  league: string;
  tags: string[];
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

/** Chip input: Enter or "," adds the typed tag (or says why it is invalid), Backspace on an empty input removes the last chip. */
function TagInput({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const full = tags.length >= MAX_TAGS;
  const typed = text.trim().toLowerCase();
  const matches = suggestions.filter((s) => !tags.includes(s) && s.includes(typed)).slice(0, 8);

  function add(tag: string) {
    if (!isValidTag(tag.trim().toLowerCase())) {
      setInvalid(true);
      return;
    }
    onChange(normalizeTags([...tags, tag]));
    setText('');
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border px-2 py-1">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded bg-poe-gold/15 px-1.5 py-0.5 text-[11px] text-poe-gold">
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
              className="hover:text-poe-error"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setInvalid(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          // readOnly, not disabled: a disabled input drops focus, and Backspace must still remove chips.
          readOnly={full}
          aria-invalid={invalid}
          placeholder={full ? `Up to ${MAX_TAGS} tags` : 'delirium, strongbox...'}
          aria-label="Add tag"
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm text-poe-text outline-none placeholder:text-poe-text-muted"
        />
      </div>
      {invalid && <p className="text-xs text-poe-error">{TAG_RULE}</p>}
      {!full && matches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded bg-poe-panel-light/50 px-1.5 py-0.5 text-[11px] text-poe-text-dim hover:text-poe-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublishModal({ strategy, onClose }: PublishModalProps) {
  const { leagues, currentLeague } = useLeague();
  const published = strategy ? getPublished(strategy.id) : null;
  const existing = useCommunityStrategy(published?.communityId ?? null);
  const exportEntity = useExportEntity();
  const save = useSavePublished();
  const tagCounts = useCommunityTags(null, strategy !== null);
  const { data: presets } = useFilterPresets();
  const { data: trees } = useAtlasTrees();
  const [form, setForm] = useState<FormState | null>(null);

  const presetName = presets?.find((p) => p.id === strategy?.config.filterPresetId)?.name;
  const treeName = trees?.find((t) => t.id === strategy?.config.atlasTreeId)?.name;

  // Start from the server copy when updating, otherwise from the local strategy and the remembered author.
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
      authorName: d?.authorName ?? (published ? '' : storage.get(AUTHOR_KEY) ?? ''),
      league: d?.league ?? currentLeague,
      tags: d?.tags ?? [],
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
      await save.mutateAsync({
        strategyId: strategy.id,
        config: strategy.config,
        request: {
          name: form.name,
          authorName: form.authorName || null,
          league: form.league,
          // The current atlas tag's major.minor (the store starts on the bundled tag).
          patch: useGameDataStore.getState().atlasTag.split('.').slice(0, 2).join('.'),
          tags: normalizeTags(form.tags),
          budget: form.budget,
          difficulty: form.difficulty,
          notes: form.notes,
          videoUrl: form.videoUrl || null,
          shareCode,
        },
      });
      const author = form.authorName.trim();
      if (author) storage.set(AUTHOR_KEY, author);
      toast.success(`${published ? 'Updated' : 'Published'} "${form.name}"`);
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
        <form onSubmit={(e) => void handleSubmit(e)} className="flex max-h-[70vh] flex-col gap-3">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1">
              <p className="text-xs text-poe-text-dim">
                Strategy <span className="text-poe-text">{strategy?.name}</span>
                {' · '}Filter preset <span className="text-poe-text">{presetName ?? 'none'}</span>
                {' · '}Atlas tree <span className="text-poe-text">{treeName ?? 'none'}</span>
              </p>
              {(!presetName || !treeName) && (
                <p className="text-xs text-poe-currency">Not linked: players will import the strategy without it.</p>
              )}
            </div>
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
                <SimpleSelect
                  value={form.league}
                  onValueChange={(v) => update('league', v)}
                  options={[
                    ...(leagues.some((l) => l.id === form.league) ? [] : [{ value: form.league, label: form.league }]),
                    ...leagues.map((l) => ({ value: l.id, label: l.text })),
                  ]}
                  aria-label="League"
                />
              </Field>
              <Field label="Budget">
                <SimpleSelect
                  value={form.budget}
                  onValueChange={(v) => update('budget', v as Budget)}
                  options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
                  aria-label="Budget"
                />
              </Field>
              <Field label="Difficulty">
                <SimpleSelect
                  value={form.difficulty}
                  onValueChange={(v) => update('difficulty', v as Difficulty)}
                  options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
                  aria-label="Difficulty"
                />
              </Field>
            </div>
            <div>
              <span className="mb-1 block text-xs text-poe-text-muted">Tags (up to {MAX_TAGS})</span>
              <TagInput
                tags={form.tags}
                onChange={(tags) => update('tags', tags)}
                suggestions={tagCounts.data?.map((t) => t.tag) ?? []}
              />
            </div>
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
          </div>

          {/* Outside the scroll area so Cancel/Publish stay visible on short windows. */}
          {error && <p className="text-xs text-poe-error">{error.message}</p>}

          <div className="flex justify-end gap-3">
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
