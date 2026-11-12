// ABOUTME: Editor toolbar title: the open entity's name (click to rename) or a placeholder, then the autosave status.
// ABOUTME: Shared by the Regex Filters and Atlas Tree pages; extra toolbar content goes in children.

import { useRef, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import type { AutosaveStatus } from '@/lib/hooks/use-entity-autosave';

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
};

/** Click to rename; Enter or blur saves, Escape cancels, a blank name reverts. */
function EditableName({ name, onRename, ariaLabel }: { name: string; onRename: (name: string) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(name)}
        title="Rename"
        className="truncate text-sm font-semibold tracking-wide text-poe-text-dim hover:text-poe-text"
      >
        {name}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim();
        setDraft(null);
        if (cancelled.current) { cancelled.current = false; return; }
        if (next && next !== name) onRename(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
      }}
      aria-label={ariaLabel}
      className="h-7 w-64 text-sm"
    />
  );
}

export function EntityTitle({
  name,
  placeholder,
  onRename,
  status,
  ariaLabel,
  children,
}: {
  /** The open entity's name, or null when nothing is open. */
  name: string | null;
  /** Shown instead of the name when nothing is open, e.g. "New preset". */
  placeholder: string;
  onRename: (name: string) => void;
  status: AutosaveStatus;
  /** Accessible label of the rename input. */
  ariaLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {name !== null ? (
        <EditableName name={name} onRename={onRename} ariaLabel={ariaLabel} />
      ) : (
        <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">{placeholder}</h3>
      )}
      {STATUS_TEXT[status] && (
        <span className={`text-xs ${status === 'error' ? 'text-poe-error' : 'text-poe-text-muted'}`}>
          {STATUS_TEXT[status]}
        </span>
      )}
      {children}
    </div>
  );
}
