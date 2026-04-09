// ABOUTME: Shared sortable item table with unit price, quantity, and total columns.
// ABOUTME: Used by both Stash browse tab and snapshot detail view.

import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PoeIcon } from '@/components/ui/poe-icon';

export interface PricedItem {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  unitPrice: number;
  total: number;
  lowListings: boolean;
}

interface PricedItemTableProps {
  items: PricedItem[];
  divinePrice: number;
  /** Show divine rate header bar (default true) */
  showDivineRate?: boolean;
  /** Show sort controls (default true) */
  sortable?: boolean;
}

type SortColumn = 'name' | 'quantity' | 'price' | 'total';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function normalizePrice(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPrice(value: number): string {
  if (value === 0) return '—';
  return normalizePrice(value).toFixed(1);
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.column === column;
  const arrow = active ? (sort.direction === 'desc' ? ' ▾' : ' ▴') : '';

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`text-xs font-medium ${active ? 'text-poe-gold' : 'text-poe-text-dim hover:text-poe-text'} ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {label}{arrow}
    </button>
  );
}

export function PricedItemTable({
  items,
  divinePrice,
  showDivineRate = true,
  sortable = true,
}: PricedItemTableProps) {
  const [sort, setSort] = useState<SortState>({ column: 'total', direction: 'desc' });

  const sortedItems = useMemo(() => {
    if (!sortable) return items;
    const sorted = [...items];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'price':
          cmp = a.unitPrice - b.unitPrice;
          break;
        case 'total':
          cmp = a.total - b.total;
          break;
      }
      return sort.direction === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [items, sort, sortable]);

  function handleSort(column: SortColumn) {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-poe-text-dim">No items to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {showDivineRate && divinePrice > 0 && (
        <div className="flex items-center gap-1.5 border-b border-poe-border/20 px-4 py-2 text-xs text-poe-text-muted">
          <span>1</span>
          <PoeIcon name="divine" size={14} />
          <span>=</span>
          <span className="text-poe-currency">{formatPrice(divinePrice)}</span>
          <PoeIcon name="chaos" size={14} />
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="border-b border-poe-border/30">
            <th className="px-4 py-2 text-left">
              {sortable
                ? <SortHeader label="Item" column="name" sort={sort} onSort={handleSort} />
                : <span className="text-xs font-medium text-poe-text-dim">Item</span>}
            </th>
            <th className="w-24 px-4 py-2 text-right">
              {sortable
                ? <SortHeader label="Qty" column="quantity" sort={sort} onSort={handleSort} align="right" />
                : <span className="text-xs font-medium text-poe-text-dim">Qty</span>}
            </th>
            <th className="w-36 px-4 py-2 text-right">
              {sortable
                ? <SortHeader label="Price" column="price" sort={sort} onSort={handleSort} align="right" />
                : <span className="text-xs font-medium text-poe-text-dim">Price</span>}
            </th>
            <th className="w-44 px-4 py-2 text-right">
              {sortable
                ? <SortHeader label="Total" column="total" sort={sort} onSort={handleSort} align="right" />
                : <span className="text-xs font-medium text-poe-text-dim">Total</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => {
            const normalizedTotal = normalizePrice(item.total);
            const showDivine = divinePrice > 0 && normalizedTotal >= divinePrice;
            const divineAmount = showDivine ? normalizePrice(normalizedTotal / divinePrice) : 0;

            return (
              <tr
                key={item.id}
                className="border-b border-poe-border/10 transition-colors hover:bg-poe-panel-light/20"
              >
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    {item.icon !== '' && (
                      <img src={item.icon} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                    )}
                    <span className="truncate text-sm text-poe-text">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right text-sm tabular-nums text-poe-text-dim">
                  {item.quantity}
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center justify-end gap-1 text-sm tabular-nums text-poe-text-dim">
                    {item.lowListings && (
                      <span title="Low listings — unreliable price">
                        <AlertTriangle size={12} className="shrink-0 text-red-500" />
                      </span>
                    )}
                    {item.unitPrice > 0 ? (
                      <>
                        <span className={item.lowListings ? 'text-poe-text-muted' : ''}>{formatPrice(item.unitPrice)}</span>
                        <PoeIcon name="chaos" size={14} />
                      </>
                    ) : (
                      <span className="text-poe-text-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex flex-col items-end gap-0.5">
                    {normalizedTotal > 0 ? (
                      showDivine ? (
                        <>
                          <div className="flex items-center gap-1 text-sm font-medium tabular-nums text-poe-currency">
                            <span>{formatPrice(divineAmount)}</span>
                            <PoeIcon name="divine" size={14} />
                          </div>
                          <div className="flex items-center gap-1 text-xs tabular-nums text-poe-text-muted">
                            <span>{formatPrice(normalizedTotal)}</span>
                            <PoeIcon name="chaos" size={12} />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-sm font-medium tabular-nums text-poe-currency">
                          <span>{formatPrice(normalizedTotal)}</span>
                          <PoeIcon name="chaos" size={14} />
                        </div>
                      )
                    ) : (
                      <span className="text-sm text-poe-text-muted">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
