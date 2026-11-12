// ABOUTME: Read-only preview of a community strategy's atlas tree in a dialog.
// ABOUTME: Starts fitted to the allocated nodes; zoom buttons and node tooltips work, clicks allocate nothing.

import { useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { TreeRenderer } from '@/components/atlas-tree/tree-renderer';
import { processTreeData } from '@/lib/atlas-tree-utils';
import type { AtlasTreePayload } from '@/lib/hooks/use-sharing';
import rawTreeData from '@/data/atlas-tree-data.json';
import type { AtlasTreeRawData } from '@/types/atlas-tree';

const treeData = rawTreeData as unknown as AtlasTreeRawData;
const MAX_POINTS = treeData.points?.totalPoints ?? 138;
const BOUNDS = { minX: treeData.min_x, minY: treeData.min_y, maxX: treeData.max_x, maxY: treeData.max_y };

export function TreePreviewModal({ tree, onClose }: { tree: AtlasTreePayload | null; onClose: () => void }) {
  const nodes = useMemo(() => processTreeData(treeData), []);
  const allocatedIds = useMemo(() => new Set(tree?.config.allocatedNodeIds ?? []), [tree]);

  return (
    <Modal isOpen={tree !== null} onClose={onClose} title={tree?.name} className="max-w-4xl">
      <p className={`text-xs tabular-nums ${allocatedIds.size > MAX_POINTS ? 'text-poe-error' : 'text-poe-text-muted'}`}>
        {allocatedIds.size} / {MAX_POINTS} pts
      </p>
      {tree && (
        <div className="relative h-[600px]">
          <TreeRenderer
            nodes={nodes}
            rawNodes={treeData.nodes}
            allocatedIds={allocatedIds}
            readOnly
            initialFit="allocated"
            sprites={treeData.sprites}
            imageZoomLevels={treeData.imageZoomLevels}
            bounds={BOUNDS}
            groups={treeData.groups}
          />
        </div>
      )}
    </Modal>
  );
}
