// ABOUTME: Zustand store for currency display preference (divine vs chaos).
// ABOUTME: Shared across all pages that show chaos/divine values; persisted via platform storage.

import { create } from 'zustand';
import { storage } from '@/lib/platform';

type CurrencyUnit = 'divine' | 'chaos';

interface CurrencyDisplayState {
  unit: CurrencyUnit;
  toggleUnit: () => void;
  setUnit: (unit: CurrencyUnit) => void;
}

const UNIT_STORAGE_KEY = 'niko_currency_unit';

export const useCurrencyDisplay = create<CurrencyDisplayState>((set) => ({
  unit: storage.get(UNIT_STORAGE_KEY) === 'chaos' ? 'chaos' : 'divine',
  toggleUnit: () =>
    set((state) => {
      const unit = state.unit === 'divine' ? 'chaos' : 'divine';
      storage.set(UNIT_STORAGE_KEY, unit);
      return { unit };
    }),
  setUnit: (unit) => {
    storage.set(UNIT_STORAGE_KEY, unit);
    set({ unit });
  },
}));
