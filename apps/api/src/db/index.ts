import fs from 'node:fs';
import path from 'node:path';
import { PARTS } from '@fluentpath/shared';
import { config } from '../config.ts';
import type { Store } from './store.ts';
import { createFileStore } from './fileStore.ts';
import { createMongoStore } from './mongoStore.ts';
import type { ItemDoc } from './types.ts';

let store: Store | null = null;

export async function initStore(): Promise<Store> {
  if (store) return store;
  if (config.mongoUri) {
    store = await createMongoStore(config.mongoUri);
    console.log('[store] connected to MongoDB');
  } else {
    store = createFileStore(config.dataDir);
    console.log(`[store] using file store at ${path.join(config.dataDir, 'db.json')} (set MONGODB_URI for MongoDB)`);
  }
  return store;
}

export function db(): Store {
  if (!store) throw new Error('store not initialised');
  return store;
}

export function loadSeedItems(): ItemDoc[] {
  const dir = path.join(config.contentDir, 'items');
  const out: ItemDoc[] = [];
  for (const part of PARTS) {
    const file = path.join(dir, `${part}.json`);
    if (!fs.existsSync(file)) continue;
    const arr = JSON.parse(fs.readFileSync(file, 'utf8')) as any[];
    for (const it of arr) {
      out.push({
        _id: it.id,
        part: it.part,
        gse: it.gse,
        difficulty: it.difficulty ?? 3,
        tags: it.tags ?? [],
        status: it.status ?? 'live',
        content: it.content,
        answerKey: it.answerKey ?? {},
        rubric: it.rubric,
        modelAnswer: it.modelAnswer,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return out;
}

/** Upsert seed items. `force` overwrites existing items with the same id. */
export async function seedItems(force = false): Promise<{ inserted: number; updated: number }> {
  const s = db();
  let inserted = 0;
  let updated = 0;
  const seedList = loadSeedItems();

  if (!force) {
    const existing = await s.items.find({});
    const existingIds = new Set(existing.map((it) => it._id));
    for (const item of seedList) {
      if (!existingIds.has(item._id)) {
        await s.items.insert(item);
        inserted++;
      }
    }
    return { inserted, updated };
  }

  for (const item of seedList) {
    const existing = await s.items.get(item._id);
    if (!existing) {
      await s.items.insert(item);
      inserted++;
    } else {
      const { _id, createdAt, ...rest } = item;
      await s.items.update(item._id, rest);
      updated++;
    }
  }
  return { inserted, updated };
}
