// ABOUTME: Zustand store for currency display preference (divine vs chaos).
// ABOUTME: Shared across all pages that show chaos/divine values.

import { create } from 'zustand';

type CurrencyUnit = 'divine' | 'chaos';

interface CurrencyDisplayState {
  unit: CurrencyUnit;
  toggleUnit: () => void;
  setUnit: (unit: CurrencyUnit) => void;
}

export const useCurrencyDisplay = create<CurrencyDisplayState>((set) => ({
  unit: 'divine',
  toggleUnit: () =>
    set((state) => ({ unit: state.unit === 'divine' ? 'chaos' : 'divine' })),
  setUnit: (unit) => set({ unit }),
}));
