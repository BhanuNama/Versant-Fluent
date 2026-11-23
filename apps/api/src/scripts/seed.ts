import { initStore, seedItems } from '../db/index.ts';

async function main() {
  console.log('[seed] initialising database store...');
  await initStore();
  console.log('[seed] upserting assessment items (force overwrite)...');
  const { inserted, updated } = await seedItems(true);
  console.log(`[seed] complete: ${inserted} inserted, ${updated} updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
