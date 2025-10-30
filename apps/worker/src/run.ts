import { config as loadEnv } from 'dotenv';

import { prisma } from '@geo/db';
import { runClientOnce, type RunOptions } from './orchestrator.js';
import type { Surface } from '@geo/core';
import { isDirectCliInvocation } from './utils/is-direct-invoke.js';

loadEnv();

function parseArgs(argv: string[]): RunOptions {
  const args = argv.slice(2);
  const options: Partial<RunOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--client':
        options.clientId = args[++index];
        break;
      case '--surfaces':
        options.surfaces = args[++index]?.split(',').map((value) => value.trim() as Surface);
        break;
      case '--limit':
        options.limit = Number.parseInt(args[++index] ?? '', 10);
        break;
      default:
        break;
    }
  }

  if (!options.clientId) {
    throw new Error('Missing required argument --client <id>');
  }

  return {
    clientId: options.clientId,
    surfaces: options.surfaces ?? ['openai', 'claude'],
    limit: options.limit && Number.isFinite(options.limit) ? options.limit : undefined
  };
}

export async function runOnce(): Promise<void> {
  const options = parseArgs(process.argv);
  console.info('[cli] Parsed run options', options);
  await runClientOnce(options);
  console.info('[cli] Run completed successfully', { clientId: options.clientId });
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  runOnce()
    .catch((error) => {
      console.error('Run failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
