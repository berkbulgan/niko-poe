// ABOUTME: Atlas tree search box: match counter, Enter / Shift+Enter cycling, a results list and Ctrl+F focus.
// ABOUTME: Matching comes from searchMatches; the page centers the tree on the node passed to onFocusNode.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cycleIndex, searchMatches } from '@/lib/atlas-tree-utils';
import type { ProcessedAtlasNode } from '@/types/atlas-tree';

const MAX_RESULTS = 8;

interface AtlasSearchProps {
  nodes: ProcessedAtlasNode[];
  query: string;
  onQueryChange: (query: string) => void;
  onFocusNode: (nodeId: string) => void;
}

export function AtlasSearch({ nodes, query, onQueryChange, onFocusNode }: AtlasSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Position of the current match in `matches`; -1 until the user cycles or picks a row.
  const [index, setIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => searchMatches(nodes, query), [nodes, query]);
  const hasQuery = query.trim() !== '';

  // Ctrl+F focuses the box while the Atlas page is mounted.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function go(i: number) {
    setIndex(i);
    onFocusNode(matches[i].id);
  }

  return (
    <div className="relative">
      {focused && hasQuery && matches.length > 0 && (
        <ul className="absolute bottom-full mb-1 w-full overflow-hidden rounded-md border border-poe-border/40 bg-poe-panel/95 py-1 shadow-lg backdrop-blur-sm">
          {matches.slice(0, MAX_RESULTS).map((node, i) => (
            <li key={node.id}>
              <button
                type="button"
                // Keep focus in the input so the list stays open.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(i)}
                className={cn('block w-full px-3 py-1 text-left hover:bg-poe-panel-light/40', i === index && 'bg-poe-panel-light/40')}
              >
                <span className={cn(
                  'block truncate text-sm',
                  node.isKeystone ? 'text-poe-currency' : node.isNotable ? 'text-poe-gold' : 'text-poe-text',
                )}>
                  {node.name}
                </span>
                {node.stats[0] && <span className="block truncate text-xs text-poe-text-muted">{node.stats[0]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => { setIndex(-1); onQueryChange(e.target.value); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const next = cycleIndex(index, matches.length, e.shiftKey ? -1 : 1);
            if (next >= 0) go(next);
          } else if (e.key === 'Escape') {
            setIndex(-1);
            onQueryChange('');
            e.currentTarget.blur();
          }
        }}
        placeholder="Search nodes (Ctrl+F)"
        aria-label="Search atlas nodes"
        className="bg-poe-panel/90 pr-16 shadow-lg backdrop-blur-sm"
      />
      {hasQuery && (
        <span className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums',
          matches.length === 0 ? 'text-poe-text-muted' : 'text-poe-text-dim',
        )}>
          {index + 1} / {matches.length}
        </span>
      )}
    </div>
  );
}
