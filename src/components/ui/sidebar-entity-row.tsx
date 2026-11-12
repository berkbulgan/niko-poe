// ABOUTME: Shared sidebar row for entity lists (presets, strategies, atlas trees).
// ABOUTME: Renders name, optional subtitle and extra content (e.g. links), active state styling, and Export/Duplicate/Delete actions
// ABOUTME: (always on the active row, on hover/focus for the others). Delete asks for confirmation.

import type React from 'react';
import { confirmAction } from '@/lib/platform';

interface SidebarEntityRowProps {
  name: string;
  active: boolean;
  onSelect: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  /** Delete confirmation text; defaults to "This can't be undone." */
  deleteDescription?: string;
  /** Optional content rendered below the name (e.g. point count) */
  subtitle?: React.ReactNode;
  /** Optional content rendered below the select button; may hold links, which cannot sit inside the button. */
  extra?: React.ReactNode;
}

export function SidebarEntityRow({
  name,
  active,
  onSelect,
  onExport,
  onDuplicate,
  onDelete,
  isDeleting,
  deleteDescription = "This can't be undone.",
  subtitle,
  extra,
}: SidebarEntityRowProps) {
  return (
    <div className={`group border-l-2 transition-all duration-100 ${active ? 'border-poe-gold bg-poe-gold/8' : 'border-transparent hover:bg-poe-panel-light/30'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-2 text-left"
      >
        <span className="block truncate text-sm text-poe-text">{name}</span>
        {subtitle}
      </button>
      {extra && <div className="px-3 pb-1">{extra}</div>}
      <div className={`items-center gap-2 px-3 pb-2 ${active ? 'flex' : 'hidden group-focus-within:flex group-hover:flex'}`}>
        <button
          onClick={onExport}
          className="text-xs text-poe-text-dim hover:text-poe-gold"
        >
          Export
        </button>
        <span className="text-poe-border">&middot;</span>
        <button
          onClick={onDuplicate}
          className="text-xs text-poe-text-dim hover:text-poe-gold"
        >
          Duplicate
        </button>
        <span className="text-poe-border">&middot;</span>
        <button
          onClick={() => {
            void confirmAction(`Delete "${name}"?`, {
              description: deleteDescription,
              confirmLabel: 'Delete',
              destructive: true,
            }).then((ok) => { if (ok) onDelete(); });
          }}
          disabled={isDeleting}
          className="text-xs text-poe-text-dim hover:text-poe-error"
        >
          {isDeleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
