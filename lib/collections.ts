import type { Db } from './db';
import { listRewards, getChestPool, listInventory } from './rewards-store';

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

  return chests.map((chest) => {
    const pool = getChestPool(db, chest.id);
    const totalItems = pool.length;
    const collectedItems = pool.filter((item) => unlockedItemIds.has(item.id)).length;
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
