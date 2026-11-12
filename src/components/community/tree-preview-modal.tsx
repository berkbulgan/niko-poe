// ABOUTME: Read-only preview of a community strategy's atlas tree in a dialog, on the tree's own atlas patch when known.
// ABOUTME: Starts fitted to the allocated nodes; zoom buttons and node tooltips work, clicks allocate nothing.

import { useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { TreeRenderer } from '@/components/atlas-tree/tree-renderer';
import { resolveTreeTag } from '@/lib/atlas-tree-utils';
import { useAtlasVersions, useTreeAtlas } from '@/lib/atlas-data';
import type { AtlasTreePayload } from '@/lib/hooks/use-sharing';

export function TreePreviewModal({ tree, onClose }: { tree: AtlasTreePayload | null; onClose: () => void }) {
  const versions = useAtlasVersions();
  // Shared trees carry no date, so only an X.Y.Z treeVersion picks a patch; others use the current data.
  const atlas = useTreeAtlas(tree ? resolveTreeTag(tree, versions) : null);
  const allocatedIds = useMemo(() => new Set(tree?.config.allocatedNodeIds ?? []), [tree]);
  const maxPoints = atlas?.data.points?.totalPoints ?? 138;
  const bounds = useMemo(
    () => atlas && { minX: atlas.data.min_x, minY: atlas.data.min_y, maxX: atlas.data.max_x, maxY: atlas.data.max_y },
    [atlas],
  );

  return (
    <Modal isOpen={tree !== null} onClose={onClose} title={tree?.name} className="max-w-4xl">
      <p className={`text-xs tabular-nums ${allocatedIds.size > maxPoints ? 'text-poe-error' : 'text-poe-text-muted'}`}>
        {allocatedIds.size} / {maxPoints} pts
      </p>
      {tree && atlas && bounds && (
        <div className="relative h-[600px]">
          <TreeRenderer
            key={atlas.tag}
            nodes={atlas.nodes}
            rawNodes={atlas.data.nodes}
            allocatedIds={allocatedIds}
            readOnly
            initialFit="allocated"
            sprites={atlas.data.sprites}
            imageZoomLevels={atlas.data.imageZoomLevels}
            assetUrl={atlas.assetUrl}
            bounds={bounds}
            groups={atlas.data.groups}
          />
        </div>
      )}
    </Modal>
  );
}
