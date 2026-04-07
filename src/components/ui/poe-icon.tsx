// ABOUTME: PoE icon component using locally served currency/item images.
// ABOUTME: Icons downloaded from poecdn.com, served from /icons/poe/*.png.

import { cn } from '@/lib/utils';

type PoeIconName =
  | 'chaos' | 'divine' | 'exalt' | 'alchemy'
  | 'chisel' | 'vaal' | 'scarab' | 'map'
  | 'quantity' | 'packsize' | 'rarity' | 'quality'
  | 'currency' | 'divination' | 'corrupted' | 'tier';

interface PoeIconProps {
  name: PoeIconName;
  size?: number;
  className?: string;
}

const ICON_ALIAS: Partial<Record<PoeIconName, PoeIconName>> = {
  quality: 'chisel',
};

export function PoeIcon({ name, size = 16, className }: PoeIconProps) {
  const fileName = ICON_ALIAS[name] ?? name;
  return (
    <img
      src={`/icons/poe/${fileName}.png`}
      alt={name}
      width={size}
      height={size}
      className={cn('inline-block', className)}
    />
  );
}

export type { PoeIconName };
