import { dryRunTest } from '../postflow-core.mjs';

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node scripts/dry-run.mjs "C:\\path\\to\\photo.jpg" [style] [English|Bilingual]');
  process.exit(1);
}

try {
  const result = await dryRunTest({ imagePath, style: process.argv[3] || '', language: process.argv[4] || 'English' });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ event: 'dry_run_failed', error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
}
