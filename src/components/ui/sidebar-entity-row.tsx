// ABOUTME: Shared sidebar row for entity lists (presets, strategies, atlas trees).
// ABOUTME: Renders name, optional subtitle, active state styling, and Export/Duplicate/Delete actions.

import type React from 'react';

interface SidebarEntityRowProps {
  name: string;
  active: boolean;
  onSelect: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  /** Optional content rendered below the name (e.g. point count) */
  subtitle?: React.ReactNode;
}

export function SidebarEntityRow({
  name,
  active,
  onSelect,
  onExport,
  onDuplicate,
  onDelete,
  isDeleting,
  subtitle,
}: SidebarEntityRowProps) {
  return (
    <div className={`border-l-2 transition-all duration-100 ${active ? 'border-poe-gold bg-poe-gold/8' : 'border-transparent hover:bg-poe-panel-light/30'}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-2 text-left"
      >
        <span className="block truncate text-sm text-poe-text">{name}</span>
        {subtitle}
      </button>
      {active && (
        <div className="flex items-center gap-2 px-3 pb-2">
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
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs text-poe-text-dim hover:text-poe-error"
          >
            {isDeleting ? '...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}
