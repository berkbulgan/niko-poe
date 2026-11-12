// ABOUTME: Right sidebar panel with allocated atlas points, keystones and one accordion section per mechanic.
// ABOUTME: Node names jump the tree to that node; the header copies a text summary and collapses the panel to a strip.

import { useMemo, useState } from 'react';
import { Copy, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { AtlasNodeData, AggregatedStat } from '@/types/atlas-tree';
import { formatStatTotal, groupByMechanic, statsText } from '@/lib/atlas-tree-utils';
import { copyToClipboard, storage } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';
import { Button } from '@/components/ui/button';
import { IconTooltip } from '@/components/ui/tooltip';

const COLLAPSED_KEY = 'niko_atlas_stats_collapsed';

interface StatsPanelProps {
  allocatedNodes: AtlasNodeData[];
  totalPoints: number;
  maxPoints: number;
  /** nodeMechanics() of the whole tree; nodes missing from it count as "Other". */
  mechanics: Map<string, string>;
  /** First line of the copied summary. */
  treeName: string;
  onFocusNode: (nodeId: string) => void;
}

function AccordionSection({
  title,
  count,
  defaultOpen,
  children,
  titleColor,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  titleColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between border-b border-poe-border/20 px-4 py-2 text-left hover:bg-poe-panel-light/20"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-poe-text-muted">{open ? '▾' : '▸'}</span>
          <h3 className={`text-xs font-semibold tracking-wider uppercase ${titleColor ?? 'text-poe-text-dim'}`}>
            {title}
          </h3>
        </div>
        <span className="text-xs text-poe-text-muted">{count}</span>
      </button>
      {open && children}
    </div>
  );
}

function AggregatedStatRow({ stat }: { stat: AggregatedStat }) {
  return (
    <div className="flex items-baseline justify-between px-4 py-1">
      <span className="text-xs text-poe-text-dim">{stat.text}</span>
      <span className="ml-2 shrink-0 text-xs font-medium tabular-nums text-poe-gold">
        {formatStatTotal(stat)}
      </span>
    </div>
  );
}

function NodeDetailRow({ node, onFocusNode }: { node: AtlasNodeData; onFocusNode: (nodeId: string) => void }) {
  return (
    <div className="border-b border-poe-border/10 px-4 py-2 last:border-b-0">
      <button
        type="button"
        onClick={() => onFocusNode(String(node.skill))}
        title="Show on tree"
        className="text-left text-sm font-medium text-poe-gold hover:underline"
      >
        {node.name}
      </button>
      {node.stats.length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {node.stats.map((stat, i) => (
            <li key={i} className="text-xs text-poe-text-dim">{stat}</li>
          ))}
        </ul>
      )}
      {node.flavourText && node.flavourText.length > 0 && (
        <p className="mt-1 text-xs italic text-poe-text-muted">
          {node.flavourText.join(' ')}
        </p>
      )}
    </div>
  );
}

export function StatsPanel({ allocatedNodes, totalPoints, maxPoints, mechanics, treeName, onFocusNode }: StatsPanelProps) {
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSED_KEY) === '1');
  const { keystones, sections } = useMemo(
    () => groupByMechanic(allocatedNodes, mechanics),
    [allocatedNodes, mechanics],
  );

  const pointRatio = maxPoints > 0 ? totalPoints / maxPoints : 0;
  const overLimit = totalPoints > maxPoints;

  function setCollapsedStored(next: boolean) {
    setCollapsed(next);
    storage.set(COLLAPSED_KEY, next ? '1' : '0');
  }

  async function handleCopy() {
    const ok = await copyToClipboard(statsText(treeName, totalPoints, maxPoints, keystones, sections));
    if (ok) toast.success('Stats copied');
    else toast.error('Could not copy to clipboard');
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-8 shrink-0 flex-col items-center gap-3 border-l border-poe-border/30 bg-poe-bg py-2">
        <IconTooltip label="Expand stats" side="left">
          <Button variant="ghost" size="sm" className="size-7 p-0" aria-label="Expand stats" onClick={() => setCollapsedStored(false)}>
            <PanelRightOpen className="size-4" />
          </Button>
        </IconTooltip>
        <span className={`text-xs font-semibold tabular-nums [writing-mode:vertical-rl] ${overLimit ? 'text-poe-error' : 'text-poe-gold'}`}>
          {totalPoints} / {maxPoints}
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-poe-border/30 bg-poe-bg xl:w-80">
      {/* Points header */}
      <div className="border-b border-poe-border/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-poe-text-dim">Atlas Points</h2>
          <div className="flex items-center gap-1">
            <span className={`mr-1 text-lg font-bold tabular-nums ${overLimit ? 'text-poe-error' : 'text-poe-gold'}`}>
              {totalPoints}
              <span className="text-sm font-normal text-poe-text-muted"> / {maxPoints}</span>
            </span>
            <IconTooltip label="Copy stats" side="bottom">
              <Button variant="ghost" size="sm" className="size-7 p-0" aria-label="Copy stats" onClick={() => { void handleCopy(); }}>
                <Copy className="size-4" />
              </Button>
            </IconTooltip>
            <IconTooltip label="Collapse stats" side="bottom">
              <Button variant="ghost" size="sm" className="size-7 p-0" aria-label="Collapse stats" onClick={() => setCollapsedStored(true)}>
                <PanelRightClose className="size-4" />
              </Button>
            </IconTooltip>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-poe-panel-light">
          <div
            className={`h-full rounded-full transition-all duration-300 ${overLimit ? 'bg-gradient-to-r from-poe-error to-red-400' : 'bg-gradient-to-r from-poe-gold to-poe-currency'}`}
            style={{ width: `${Math.min(pointRatio * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Keystones — top priority */}
        <AccordionSection
          title="Keystones"
          count={keystones.length}
          defaultOpen={true}
          titleColor="text-poe-currency"
        >
          {keystones.length > 0 ? (
            <div className="py-1">
              {keystones.map((node) => (
                <NodeDetailRow key={node.skill} node={node} onFocusNode={onFocusNode} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-poe-text-muted">No keystones allocated</p>
          )}
        </AccordionSection>

        {/* One section per mechanic, most points first, Other last */}
        {sections.map((section) => (
          <AccordionSection key={section.mechanic} title={section.mechanic} count={section.points}>
            <div className="py-1">
              {section.notables.map((node) => (
                <NodeDetailRow key={node.skill} node={node} onFocusNode={onFocusNode} />
              ))}
              {section.smallStats.map((stat) => (
                <AggregatedStatRow key={stat.text} stat={stat} />
              ))}
            </div>
          </AccordionSection>
        ))}
      </div>
    </aside>
  );
}
