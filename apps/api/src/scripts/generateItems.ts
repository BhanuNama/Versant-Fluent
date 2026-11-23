import { PARTS, type PartId } from '@fluentpath/shared';
import { db, initStore } from '../db/index.ts';
import { generatePartItems } from '../services/itemGeneratorService.ts';

async function main() {
  await initStore();

  const args = process.argv.slice(2);
  const targetPart = args.find((a) => a.startsWith('--part='))?.split('=')[1]?.toUpperCase() as PartId | undefined;
  const count = parseInt(args.find((a) => a.startsWith('--count='))?.split('=')[1] || '3', 10);
  const level = (args.find((a) => a.startsWith('--level='))?.split('=')[1]?.toLowerCase() as 'easy' | 'medium' | 'hard') || 'medium';
  const partsToGen: PartId[] = targetPart ? [targetPart] : [...PARTS];

  console.log(`[generator] Generating ${count} items each for parts [${partsToGen.join(', ')}] at level '${level}'...`);

  let totalInserted = 0;

  for (const part of partsToGen) {
    try {
      console.log(`[generator] Generating for Part ${part}...`);
      const newItems = await generatePartItems(part, count, level);
      for (const item of newItems) {
        await db().items.insert(item);
        totalInserted++;
      }
      console.log(`[generator] Successfully generated & inserted ${newItems.length} items for Part ${part}.`);
      // Small pause between generations to respect Groq rate limits
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err: any) {
      console.error(`[generator] Failed generating for Part ${part}:`, err.message);
    }
  }

  console.log(`\n[generator] Complete! Total new items generated and added to live bank: ${totalInserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[generator] Uncaught error:', err);
  process.exit(1);
});
