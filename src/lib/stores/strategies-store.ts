// ABOUTME: Zustand store for Strategies page — persists active strategy selection and StrategyBuilder draft state across navigation.
// ABOUTME: Replaces local useState + forwardRef pattern so state survives page unmount/remount.

import { create } from 'zustand';
import type { StrategyConfig, StrategyItem, SelectedItem, PriceCategory } from '@/types/strategies';

interface StrategiesState {
  // Page-level selection
  activeStrategyId: string | null;

  // StrategyBuilder draft state
  selectedItems: SelectedItem[];
  averageMapCost: number;
  mapCount: number;
  filterPresetId: string | null;
  atlasTreeId: string | null;
  category: PriceCategory;
  showPicker: boolean;
  searchQuery: string;

  // Actions
  setActiveStrategyId: (id: string | null) => void;
  setSelectedItems: (items: SelectedItem[]) => void;
  addItem: (item: SelectedItem) => void;
  updateItemQuantity: (itemId: number, category: string, qty: number) => void;
  removeItem: (itemId: number, category: string) => void;
  setAverageMapCost: (cost: number) => void;
  setMapCount: (count: number) => void;
  setFilterPresetId: (id: string | null) => void;
  setAtlasTreeId: (id: string | null) => void;
  setCategory: (cat: PriceCategory) => void;
  setShowPicker: (show: boolean) => void;
  setSearchQuery: (query: string) => void;

  // Config get/load (replaces imperative handle)
  getConfig: () => StrategyConfig;
  loadConfig: (config: StrategyConfig, mapsPerUseMap: Partial<Record<string, number>>) => void;
}

export const useStrategiesStore = create<StrategiesState>((set, get) => ({
  activeStrategyId: null,
  selectedItems: [],
  averageMapCost: 0,
  mapCount: 100,
  filterPresetId: null,
  atlasTreeId: null,
  category: 'scarab',
  showPicker: false,
  searchQuery: '',

  setActiveStrategyId: (id) => set({ activeStrategyId: id }),

  setSelectedItems: (items) => set({ selectedItems: items }),

  addItem: (item) => set((state) => {
    const existing = state.selectedItems.find(
      (i) => i.itemId === item.itemId && i.category === item.category,
    );
    if (existing) {
      return {
        selectedItems: state.selectedItems.map((i) =>
          i.itemId === item.itemId && i.category === item.category
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        ),
      };
    }
    return { selectedItems: [...state.selectedItems, item] };
  }),

  updateItemQuantity: (itemId, category, qty) => set((state) => ({
    selectedItems: state.selectedItems.map((i) =>
      i.itemId === itemId && i.category === category ? { ...i, quantity: qty } : i,
    ),
  })),

  removeItem: (itemId, category) => set((state) => ({
    selectedItems: state.selectedItems.filter(
      (i) => !(i.itemId === itemId && i.category === category),
    ),
  })),

  setAverageMapCost: (cost) => set({ averageMapCost: cost }),
  setMapCount: (count) => set({ mapCount: count }),
  setFilterPresetId: (id) => set({ filterPresetId: id }),
  setAtlasTreeId: (id) => set({ atlasTreeId: id }),
  setCategory: (cat) => set({ category: cat }),
  setShowPicker: (show) => set({ showPicker: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getConfig: (): StrategyConfig => {
    const state = get();
    return {
      items: state.selectedItems.map((si): StrategyItem => ({
        itemId: si.itemId,
        name: si.name,
        category: si.category,
        quantity: si.quantity,
        unitPrice: si.unitPrice,
        icon: si.icon,
        mapsPerUse: si.mapsPerUse > 1 ? si.mapsPerUse : undefined,
      })),
      averageMapCost: state.averageMapCost,
      mapCount: state.mapCount,
      filterPresetId: state.filterPresetId,
      atlasTreeId: state.atlasTreeId,
    };
  },

  loadConfig: (config, mapsPerUseMap) => set({
    selectedItems: config.items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      icon: item.icon,
      mapsPerUse: mapsPerUseMap[item.category] ?? item.mapsPerUse ?? 1,
    })),
    averageMapCost: config.averageMapCost,
    mapCount: config.mapCount,
    filterPresetId: config.filterPresetId ?? null,
    atlasTreeId: config.atlasTreeId ?? null,
  }),
}));

export type { SelectedItem } from '@/types/strategies';
