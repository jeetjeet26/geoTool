import { prisma } from '../src/index.js';
import { runClientOnce } from '../src/run.js';

async function main() {
  const clientId = process.argv[2];

  if (!clientId) {
    console.error('Usage: tsx scripts/run-client-once.ts <clientId> [limit]');
    process.exitCode = 1;
    return;
  }

  const limitArg = process.argv[3];
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

  await runClientOnce({
    clientId,
    surfaces: ['openai'],
    limit: Number.isFinite(limit) ? limit : undefined
  });
}

main()
  .catch((error) => {
    console.error('run-client-once failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

