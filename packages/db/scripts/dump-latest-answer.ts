import { prisma } from '../src/index.js';

async function main() {
  const answer = await prisma.answer.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (!answer) {
    console.log('No answers found.');
    return;
  }

  console.log('=== Raw Answer Payload ===');
  console.log(JSON.stringify(answer.rawJson, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

