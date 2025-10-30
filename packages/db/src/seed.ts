import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { config as loadEnv } from 'dotenv';
import YAML from 'yaml';
import { z } from 'zod';

import { prisma } from './index.js';

loadEnv();

async function readSeedFile(fileName: string): Promise<string> {
  const cwd = process.cwd();
  const candidates = [path.join(cwd, 'seed'), path.join(cwd, '..', '..', 'seed')];

  for (const base of candidates) {
    try {
      return await readFile(path.join(base, fileName), 'utf8');
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    `Could not find seed file ${fileName}. Looked in ${candidates.join('; ')}`
  );
}

const ClientSeedSchema = z.object({
  name: z.string(),
  domains: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([])
});

const ClientsSeedSchema = z.array(ClientSeedSchema);

const QuerySeedSchema = z.object({
  client: z.string(),
  domains: z.array(z.string()),
  competitors: z.array(z.string()).default([]),
  queries: z.array(
    z.object({
      text: z.string(),
      type: z.enum(['branded', 'category', 'comparison', 'local', 'faq']),
      geo: z.string().optional(),
      weight: z.number().optional()
    })
  )
});

async function loadClients() {
  const file = await readSeedFile('clients.example.json');
  const json = JSON.parse(file);
  return ClientsSeedSchema.parse(json);
}

async function loadQueries() {
  const file = await readSeedFile('queries.example.yaml');
  const yaml = YAML.parse(file);
  return QuerySeedSchema.parse(yaml);
}

async function seed() {
  const [clients, queryPanel] = await Promise.all([loadClients(), loadQueries()]);

  const client = clients.find((item) => item.name === queryPanel.client);

  if (!client) {
    throw new Error(`No client seed found for query panel client: ${queryPanel.client}`);
  }

  await prisma.$transaction([
    prisma.citation.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.score.deleteMany(),
    prisma.run.deleteMany(),
    prisma.query.deleteMany(),
    prisma.client.deleteMany()
  ]);

  const createdClient = await prisma.client.create({
    data: {
      name: client.name,
      domains: client.domains,
      competitors: client.competitors
    }
  });

  await prisma.query.createMany({
    data: queryPanel.queries.map((item) => ({
      clientId: createdClient.id,
      text: item.text,
      type: item.type,
      geo: item.geo ?? null,
      weight: item.weight ?? 1
    }))
  });

  console.log(
    `Seed complete. Created client ${createdClient.name} with ${queryPanel.queries.length} queries.`
  );
}

seed()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
