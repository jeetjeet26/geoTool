import { config as loadEnv } from 'dotenv';

import { prisma } from '@geo/db';
import type { Surface } from '@geo/core';

import { runClientOnce } from './orchestrator.js';
import { isDirectCliInvocation } from './utils/is-direct-invoke.js';

loadEnv();

interface SchedulerOptions {
  surfaces: Surface[];
  limit?: number;
  retries: number;
}

function parseArgs(argv: string[]): SchedulerOptions {
  const args = argv.slice(2);
  const options: Partial<SchedulerOptions> = { retries: 2 };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--surfaces':
        options.surfaces = args[++index]?.split(',').map((value) => value.trim() as Surface);
        break;
      case '--limit':
        options.limit = Number.parseInt(args[++index] ?? '', 10);
        break;
      case '--retries':
        options.retries = Number.parseInt(args[++index] ?? '', 10);
        break;
      default:
        break;
    }
  }

  return {
    surfaces: options.surfaces ?? ['openai', 'claude'],
    limit: options.limit && Number.isFinite(options.limit) ? options.limit : undefined,
    retries: options.retries ?? 2
  };
}

async function runWithRetries(clientId: string, options: SchedulerOptions) {
  let attempt = 0;
  let error: unknown;

  while (attempt <= options.retries) {
    try {
      await runClientOnce({ clientId, surfaces: options.surfaces, limit: options.limit });
      return;
    } catch (err) {
      error = err;
      attempt += 1;
      const waitMs = Math.min(1000 * 2 ** attempt, 30_000);
      console.warn(`Run failed for client ${clientId} (attempt ${attempt}). Retrying in ${waitMs}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  console.error(`Run failed for client ${clientId} after ${options.retries} retries`, error);
}

export async function scheduleRuns(): Promise<void> {
  const options = parseArgs(process.argv);
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });

  if (clients.length === 0) {
    console.warn('No clients found. Scheduler exiting.');
    return;
  }

  for (const client of clients) {
    console.log(`Starting scheduled run for client ${client.name} (${client.id})`);
    await runWithRetries(client.id, options);
  }
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  scheduleRuns()
    .catch((error) => {
      console.error('Scheduler failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
