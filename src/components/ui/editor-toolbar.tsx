// ABOUTME: Shared toolbar for entity editor pages (Filters, Strategies, AtlasTree).
// ABOUTME: Renders title, unsaved changes indicator, Save/Save As buttons, and optional extra actions.

import type React from 'react';
import { Button } from '@/components/ui/button';

interface EditorToolbarProps {
  title: string;
  hasUnsavedChanges: boolean;
  hasActiveEntity: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  /** Extra content rendered next to the title (e.g. point counter) */
  titleExtra?: React.ReactNode;
  /** Extra actions rendered before the save buttons (e.g. Undo/Reset) */
  actions?: React.ReactNode;
  /** Override default padding — AtlasTree uses py-2 instead of py-3 */
  compact?: boolean;
}

export function EditorToolbar({
  title,
  hasUnsavedChanges,
  hasActiveEntity,
  onSave,
  onSaveAs,
  titleExtra,
  actions,
  compact,
}: EditorToolbarProps) {
  return (
    <div className={`flex items-center justify-between border-b border-poe-border/20 px-4 ${compact ? 'py-2' : 'py-3'} lg:px-6`}>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">{title}</h3>
        {titleExtra}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {hasUnsavedChanges && (
          <span className="text-xs text-poe-currency">Unsaved Changes</span>
        )}
        {hasActiveEntity && (
          <Button variant="ghost" size="sm" onClick={onSave}>Save</Button>
        )}
        <Button variant="primary" size="sm" onClick={onSaveAs}>
          {hasActiveEntity ? 'Save As' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
