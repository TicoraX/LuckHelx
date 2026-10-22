import type { Db } from './db';
import { listRewards } from './rewards-store';

export interface ChestCollectionInfo {
  chestId: string;
  chestName: string;
  chestImage: string | null;
  totalItems: number;
  collectedItems: number;
  percentComplete: number;
  isCompleted: boolean;
}

export function getChestCollections(db: Db): ChestCollectionInfo[] {
  const allRewards = listRewards(db);
  const chests = allRewards.filter((r) => r.type === 'chest');

  const unlockedRows = db
    .prepare('SELECT DISTINCT won_item_id FROM redemptions WHERE won_item_id IS NOT NULL')
    .all() as { won_item_id: string }[];
  const unlockedItemIds = new Set(unlockedRows.map((r) => r.won_item_id));

  const contentsRows = db.prepare('SELECT chest_id, chest_item_id FROM chest_contents').all() as {
    chest_id: string;
    chest_item_id: string;
  }[];
  const poolByChest = new Map<string, string[]>();
  for (const row of contentsRows) {
    const list = poolByChest.get(row.chest_id);
    if (list) list.push(row.chest_item_id);
    else poolByChest.set(row.chest_id, [row.chest_item_id]);
  }

  return chests.map((chest) => {
    const pool = poolByChest.get(chest.id) ?? [];
    const totalItems = pool.length;
    const collectedItems = pool.filter((itemId) => unlockedItemIds.has(itemId)).length;
    const percentComplete = totalItems > 0 ? Math.round((collectedItems / totalItems) * 100) : 0;

    return {
      chestId: chest.id,
      chestName: chest.name,
      chestImage: chest.image,
      totalItems,
      collectedItems,
      percentComplete,
      isCompleted: totalItems > 0 && collectedItems === totalItems,
    };
  });
}
