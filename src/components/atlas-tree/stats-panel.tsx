// ABOUTME: Right sidebar panel displaying allocated atlas tree stats grouped by node type.
// ABOUTME: Accordion sections: keystones → notables → small passives, collapsible for compact view.

import { useState } from 'react';
import type { AtlasNodeData, AggregatedStat } from '@/types/atlas-tree';
import { aggregateStats } from '@/lib/atlas-tree-utils';
import { useMemo } from 'react';

interface StatsPanelProps {
  allocatedNodes: AtlasNodeData[];
  totalPoints: number;
  maxPoints: number;
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
  const displayTotal = Number.isInteger(stat.total)
    ? stat.total
    : parseFloat(stat.total.toFixed(2));

  return (
    <div className="flex items-baseline justify-between px-4 py-1">
      <span className="text-xs text-poe-text-dim">{stat.text}</span>
      <span className="ml-2 shrink-0 text-xs font-medium tabular-nums text-poe-gold">
        {displayTotal > 0 ? '+' : ''}{displayTotal}{stat.unit}
      </span>
    </div>
  );
}

function NodeDetailRow({ node }: { node: AtlasNodeData }) {
  return (
    <div className="border-b border-poe-border/10 px-4 py-2 last:border-b-0">
      <p className="text-sm font-medium text-poe-gold">{node.name}</p>
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

export function StatsPanel({ allocatedNodes, totalPoints, maxPoints }: StatsPanelProps) {
  const smallPassives = useMemo(
    () => allocatedNodes.filter((n) => !n.isNotable && !n.isKeystone && !n.isMastery && !n.isWormhole),
    [allocatedNodes],
  );
  const notables = useMemo(
    () => allocatedNodes.filter((n) => n.isNotable),
    [allocatedNodes],
  );
  const keystones = useMemo(
    () => allocatedNodes.filter((n) => n.isKeystone),
    [allocatedNodes],
  );

  const aggregatedSmallStats = useMemo(
    () => aggregateStats(smallPassives),
    [smallPassives],
  );

  const pointRatio = maxPoints > 0 ? totalPoints / maxPoints : 0;
  const overLimit = totalPoints > maxPoints;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-poe-border/30 bg-poe-bg xl:w-80">
      {/* Points header */}
      <div className="border-b border-poe-border/20 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-poe-text-dim">Atlas Points</h2>
          <span className={`text-lg font-bold tabular-nums ${overLimit ? 'text-poe-error' : 'text-poe-gold'}`}>
            {totalPoints}
            <span className="text-sm font-normal text-poe-text-muted"> / {maxPoints}</span>
          </span>
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
              {keystones.map((node, i) => (
                <NodeDetailRow key={i} node={node} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-poe-text-muted">No keystones allocated</p>
          )}
        </AccordionSection>

        {/* Notables */}
        <AccordionSection
          title="Notables"
          count={notables.length}
          defaultOpen={true}
          titleColor="text-poe-gold"
        >
          {notables.length > 0 ? (
            <div className="py-1">
              {notables.map((node, i) => (
                <NodeDetailRow key={i} node={node} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-poe-text-muted">No notables allocated</p>
          )}
        </AccordionSection>

        {/* Small passives — aggregated */}
        <AccordionSection
          title="Small Passives"
          count={smallPassives.length}
          defaultOpen={false}
        >
          {aggregatedSmallStats.length > 0 ? (
            <div className="py-1">
              {aggregatedSmallStats.map((stat, i) => (
                <AggregatedStatRow key={i} stat={stat} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-poe-text-muted">No small passives allocated</p>
          )}
        </AccordionSection>
      </div>
    </aside>
  );
}
