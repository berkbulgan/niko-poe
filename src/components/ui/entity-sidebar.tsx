// ABOUTME: Shared sidebar wrapper for entity editor pages (Filters, Strategies, AtlasTree).
// ABOUTME: Renders header with title + Import button, loading spinner, empty state, or entity list.

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface EntitySidebarProps {
  title: string;
  onImport: () => void;
  isLoading: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}

export function EntitySidebar({
  title,
  onImport,
  isLoading,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: EntitySidebarProps) {
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-poe-border/30 xl:w-56">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
        <h2 className="text-sm font-semibold text-poe-text-dim">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onImport}>
          Import
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : isEmpty ? (
          <div className="p-4 text-center">
            <p className="text-sm text-poe-text-dim">{emptyTitle}</p>
            <p className="mt-1 text-xs text-poe-text-muted">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-px p-1">
            {children}
          </div>
        )}
      </div>
    </aside>
  );
}
