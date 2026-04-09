// ABOUTME: Export/import hooks for sharing FilterPresets, AtlasTrees, and Strategies.
// ABOUTME: Handles encoding, decoding, pastebin fetch, content-hash dedup, and name collision.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import type { FilterPresetConfig } from '@/types/filters';
import type { StrategyConfig } from '@/types/strategies';
import type { AtlasTreeConfig } from '@/types/atlas-tree';

// --- Export payload shapes ---

interface FilterPresetPayload {
  name: string;
  config: FilterPresetConfig;
}

interface AtlasTreePayload {
  name: string;
  config: AtlasTreeConfig;
}

interface StrategyBundlePayload {
  name: string;
  config: StrategyConfig;
  filterPreset: FilterPresetPayload | null;
  atlasTree: AtlasTreePayload | null;
}

// --- Import result ---

type EntityType = 'F' | 'A' | 'S';

interface ImportResult {
  entityType: EntityType;
  /** IDs of created or reused entities. */
  createdIds: {
    strategyId?: string;
    filterPresetId?: string;
    atlasTreeId?: string;
  };
  /** Whether each entity was reused (dedup matched) or newly created. */
  reused: {
    filterPreset?: boolean;
    atlasTree?: boolean;
  };
}

// --- Helpers ---

const PASTEBIN_PATTERN = /pastebin\.com/i;

function isPastebinUrl(input: string): boolean {
  return PASTEBIN_PATTERN.test(input.trim());
}

/** Find a unique name among existing names by appending " (2)", " (3)", etc. */
function uniqueName(desired: string, existingNames: string[]): string {
  if (!existingNames.includes(desired)) return desired;
  let counter = 2;
  while (existingNames.includes(`${desired} (${counter})`)) {
    counter++;
  }
  return `${desired} (${counter})`;
}

/** Hash a config object deterministically via Rust SHA256. */
async function hashConfig(config: unknown): Promise<string> {
  return ipc.contentHash(JSON.stringify(config));
}

/**
 * Find an existing entity whose config content-hashes to the same value.
 * Returns the entity ID if a match is found, null otherwise.
 */
async function findDuplicate<TEntity extends { id: string; config: string }>(
  incomingConfig: unknown,
  existingEntities: TEntity[],
): Promise<string | null> {
  const incomingHash = await hashConfig(incomingConfig);

  for (const entity of existingEntities) {
    const parsed: unknown = JSON.parse(entity.config);
    const existingHash = await hashConfig(parsed);
    if (existingHash === incomingHash) {
      return entity.id;
    }
  }

  return null;
}

// --- Export hook ---

interface ExportFilterPresetInput {
  type: 'F';
  name: string;
  config: FilterPresetConfig;
}

interface ExportAtlasTreeInput {
  type: 'A';
  name: string;
  config: AtlasTreeConfig;
}

interface ExportStrategyInput {
  type: 'S';
  name: string;
  config: StrategyConfig;
}

export type ExportInput = ExportFilterPresetInput | ExportAtlasTreeInput | ExportStrategyInput;

export function useExportEntity() {
  return useMutation<string, Error, ExportInput>({
    mutationFn: async (input) => {
      let payload: string;

      if (input.type === 'S') {
        // Build strategy bundle with linked entities.
        const bundle: StrategyBundlePayload = {
          name: input.name,
          config: { ...input.config, filterPresetId: null, atlasTreeId: null },
          filterPreset: null,
          atlasTree: null,
        };

        if (input.config.filterPresetId) {
          const preset = await ipc.getFilterPreset(input.config.filterPresetId);
          const parsedConfig = JSON.parse(preset.config) as FilterPresetConfig;
          bundle.filterPreset = { name: preset.name, config: parsedConfig };
        }

        if (input.config.atlasTreeId) {
          const tree = await ipc.getAtlasTree(input.config.atlasTreeId);
          const parsedConfig = JSON.parse(tree.config) as AtlasTreeConfig;
          bundle.atlasTree = { name: tree.name, config: parsedConfig };
        }

        payload = JSON.stringify(bundle);
      } else {
        payload = JSON.stringify({ name: input.name, config: input.config });
      }

      const code = await ipc.encodeShareCode(input.type, payload);
      return code;
    },
  });
}

// --- Import hook ---

interface ImportInput {
  code: string;
}

export function useImportEntity() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ImportInput>({
    mutationFn: async ({ code }) => {
      let shareCode = code.trim();

      // If it's a pastebin URL, fetch the raw content first.
      if (isPastebinUrl(shareCode)) {
        shareCode = await ipc.importFromPastebin(shareCode);
      }

      const decoded = await ipc.decodeShareCode(shareCode);
      const entityType = decoded.entityType as EntityType;
      const parsedPayload: unknown = JSON.parse(decoded.payloadJson);

      if (entityType === 'F') {
        return importFilterPreset(parsedPayload as FilterPresetPayload);
      }

      if (entityType === 'A') {
        return importAtlasTree(parsedPayload as AtlasTreePayload);
      }

      if (entityType === 'S') {
        return importStrategyBundle(parsedPayload as StrategyBundlePayload);
      }

      throw new Error(`Unknown entity type: ${entityType}`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      void queryClient.invalidateQueries({ queryKey: ['atlas-trees'] });
      void queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

// --- Import implementations ---

async function importFilterPreset(payload: FilterPresetPayload): Promise<ImportResult> {
  const existing = await ipc.getFilterPresets();
  const dupId = await findDuplicate(payload.config, existing);

  if (dupId) {
    return {
      entityType: 'F',
      createdIds: { filterPresetId: dupId },
      reused: { filterPreset: true },
    };
  }

  const existingNames = existing.map((e) => e.name);
  const name = uniqueName(payload.name, existingNames);
  const created = await ipc.createFilterPreset({ name, config: JSON.stringify(payload.config) });

  return {
    entityType: 'F',
    createdIds: { filterPresetId: created.id },
    reused: { filterPreset: false },
  };
}

async function importAtlasTree(payload: AtlasTreePayload): Promise<ImportResult> {
  const existing = await ipc.getAtlasTrees();
  const dupId = await findDuplicate(payload.config, existing);

  if (dupId) {
    return {
      entityType: 'A',
      createdIds: { atlasTreeId: dupId },
      reused: { atlasTree: true },
    };
  }

  const existingNames = existing.map((e) => e.name);
  const name = uniqueName(payload.name, existingNames);
  const created = await ipc.createAtlasTree({ name, config: JSON.stringify(payload.config) });

  return {
    entityType: 'A',
    createdIds: { atlasTreeId: created.id },
    reused: { atlasTree: false },
  };
}

async function importStrategyBundle(payload: StrategyBundlePayload): Promise<ImportResult> {
  const result: ImportResult = {
    entityType: 'S',
    createdIds: {},
    reused: {},
  };

  let filterPresetId: string | null = null;
  let atlasTreeId: string | null = null;

  // Import linked FilterPreset if present.
  if (payload.filterPreset) {
    const fpResult = await importFilterPreset(payload.filterPreset);
    filterPresetId = fpResult.createdIds.filterPresetId ?? null;
    result.createdIds.filterPresetId = fpResult.createdIds.filterPresetId;
    result.reused.filterPreset = fpResult.reused.filterPreset;
  }

  // Import linked AtlasTree if present.
  if (payload.atlasTree) {
    const atResult = await importAtlasTree(payload.atlasTree);
    atlasTreeId = atResult.createdIds.atlasTreeId ?? null;
    result.createdIds.atlasTreeId = atResult.createdIds.atlasTreeId;
    result.reused.atlasTree = atResult.reused.atlasTree;
  }

  // Build strategy config with resolved IDs.
  const strategyConfig: StrategyConfig = {
    ...payload.config,
    filterPresetId,
    atlasTreeId,
  };

  // Check name collision for the strategy itself.
  const existingStrategies = await ipc.getStrategies();
  const existingNames = existingStrategies.map((e) => e.name);
  const name = uniqueName(payload.name, existingNames);

  const created = await ipc.createStrategy({ name, config: JSON.stringify(strategyConfig) });
  result.createdIds.strategyId = created.id;

  return result;
}
