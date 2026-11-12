// ABOUTME: Atlas tree data per GGG atlastree-export tag: the bundled tag from src/data, other tags downloaded by Rust.
// ABOUTME: useAtlasData/useTreeAtlas load a tag's data and sprite URLs; refreshAtlasTag picks the current tag.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as ipc from '@/lib/ipc';
import { assetFileUrl } from '@/lib/platform';
import { cleanTreeText, pickAtlasTag, processTreeData } from '@/lib/atlas-tree-utils';
import { useGameDataStore } from '@/lib/stores/game-data-store';
import rawTreeData from '@/data/atlas-tree-data.json';
import sources from '@/data/sources.json';
import type { AtlasTreeRawData, ProcessedAtlasNode } from '@/types/atlas-tree';
import type { AtlasVersion } from '@/types/game-data';

export interface AtlasDataset {
  tag: string;
  data: AtlasTreeRawData;
  nodes: ProcessedAtlasNode[];
  /** URL of one of this tag's sprite sheet files, by file name. */
  assetUrl: (filename: string) => string;
}

/** The atlas tag bundled with the app (src/data, public/atlas). */
export const BUNDLED_ATLAS: AtlasVersion = { tag: sources.atlasTag, releasedAt: sources.atlasReleasedAt };

const REFRESH_MS = 24 * 60 * 60 * 1000;

let bundled: AtlasDataset | undefined;
function bundledDataset(): AtlasDataset {
  if (!bundled) {
    const data = cleanTreeText(rawTreeData as unknown as AtlasTreeRawData);
    bundled = { tag: BUNDLED_ATLAS.tag, data, nodes: processTreeData(data), assetUrl: (f) => `/atlas/${f}` };
  }
  return bundled;
}

async function loadDataset(tag: string): Promise<AtlasDataset | null> {
  if (tag === BUNDLED_ATLAS.tag) return bundledDataset();
  const files = await ipc.atlasData(tag);
  if (!files) return null;
  const data = cleanTreeText(JSON.parse(files.dataJson) as AtlasTreeRawData);
  return { tag, data, nodes: processTreeData(data), assetUrl: (f) => assetFileUrl(`${files.assetDir}/${f}`) };
}

/** One tag's atlas data. null: the tag is on neither disk nor the server. An error (offline, 429) is not retried. */
export function useAtlasData(tag: string) {
  return useQuery({
    queryKey: ['atlas-data', tag],
    queryFn: () => loadDataset(tag),
    initialData: tag === BUNDLED_ATLAS.tag ? bundledDataset : undefined,
    staleTime: Infinity,
    retry: false,
  });
}

/** A saved tree's atlas data, or the current tag's when its tag is null or unavailable; undefined while loading. */
export function useTreeAtlas(tag: string | null): AtlasDataset | undefined {
  const currentTag = useGameDataStore((s) => s.atlasTag);
  const own = useAtlasData(tag ?? currentTag);
  const current = useAtlasData(currentTag);
  if (own.isPending) return undefined;
  // current.data is never null in practice (the current tag always loads), but the type allows it.
  return own.data ?? current.data ?? undefined;
}

/** The server's tags plus the bundled one: the tags resolveTreeTag can map a legacy tree to. */
export function useAtlasVersions(): AtlasVersion[] {
  const index = useGameDataStore((s) => s.atlasVersions);
  return useMemo(
    () => (index.some((v) => v.tag === BUNDLED_ATLAS.tag) ? index : [...index, BUNDLED_ATLAS]),
    [index],
  );
}

const canLoad = (tag: string) => ipc.atlasData(tag).then((files) => files !== null, () => false);

/**
 * Picks the current tag from the saved tag list first, then from the server's (offline: the saved pick stays).
 * The saved pass reads only the disk, so a restart is back on its last tag before the network wait; until then
 * trees on that tag would look newer than the current tag and offer an Update that drops nodes.
 * newTag: the current tag when it changed, else null. answered: the server sent its tag list and its newest tag
 * loaded. Never rejects.
 */
export async function refreshAtlasTag(): Promise<{ newTag: string | null; answered: boolean }> {
  const before = useGameDataStore.getState().atlasTag;
  let answered = false;
  for (const refresh of [false, true]) {
    const versions = await ipc.atlasVersions(refresh).catch(() => null);
    if (!versions) continue;
    const tag = await pickAtlasTag(versions, BUNDLED_ATLAS, canLoad);
    // A newer listed tag that could not be downloaded (429, timeout) is not an up-to-date answer.
    const newest = versions.reduce((a, b) => (b.releasedAt > a.releasedAt ? b : a), BUNDLED_ATLAS);
    answered = refresh && tag === newest.tag;
    // An open tree keeps saving under the tag it was opened on (atlas-tree-store editingTag), so a tag landing mid-session
    // never restamps old-patch node ids; the tree just turns read-only. Only an empty new draft moves to the new tag.
    useGameDataStore.setState({ atlasVersions: versions, atlasTag: tag });
  }
  const after = useGameDataStore.getState().atlasTag;
  return { newTag: after === before ? null : after, answered };
}

/** Main window only: picks the current atlas tag now and every 24 h. */
export function startAtlasRefresh(): void {
  void refreshAtlasTag();
  setInterval(() => { void refreshAtlasTag(); }, REFRESH_MS);
}
