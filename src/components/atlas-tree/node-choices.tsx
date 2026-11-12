// ABOUTME: 3.30 multiple-choice notables: NodeChoices lists a node's variants (marking the chosen one), and
// ABOUTME: VariantPicker is the small popup that asks which variant to take when such a node is allocated.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { AtlasNodeData } from '@/types/atlas-tree';

/** The node's variants; the chosen one is marked. chosenOnly lists just the chosen one when there is one. */
export function NodeChoices({ node, chosen, chosenOnly }: { node: AtlasNodeData; chosen?: number; chosenOnly?: boolean }) {
  if (!node.variantEffects?.length) return null;
  const picked = node.variantEffects.find((v) => v.effect === chosen);
  const shown = chosenOnly && picked ? [picked] : node.variantEffects;
  return (
    <div className="mt-1">
      {!(chosenOnly && picked) && <p className="text-xs text-poe-text-muted">{picked ? 'Chosen:' : 'One of:'}</p>}
      <ul className="space-y-0.5">
        {shown.map((v) => (
          <li
            key={v.effect}
            className={cn('text-xs', v === picked ? 'text-poe-gold' : picked ? 'text-poe-text-muted' : 'text-poe-text-dim')}
          >
            {v === picked && !chosenOnly ? '✓' : '•'} {v.stats.join('; ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Popup at a screen point asking which variant of `node` to take. Picking calls onPick with the effect id;
 * Escape or a click outside calls onCancel.
 */
export function VariantPicker({ node, x, y, onPick, onCancel }: {
  node: AtlasNodeData;
  x: number;
  y: number;
  onPick: (effect: number) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[60]" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-label={`Choose ${node.name}`}
        className="fixed w-80 rounded border border-poe-border bg-poe-panel px-3 py-2 shadow-lg"
        style={{ left: x, top: y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-poe-gold">{node.name}</p>
        {node.stats.length > 0 && <p className="text-xs text-poe-text-dim">{node.stats.join(' ')}</p>}
        <p className="mt-1 text-xs text-poe-text-muted">Choose one:</p>
        <div className="mt-1 flex flex-col gap-1">
          {node.variantEffects?.map((v) => (
            <button
              key={v.effect}
              type="button"
              onClick={() => onPick(v.effect)}
              className="rounded border border-poe-border/40 px-2 py-1 text-left text-xs text-poe-text hover:border-poe-gold/60 hover:bg-poe-panel-light/40"
            >
              {v.stats.join('; ')}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
