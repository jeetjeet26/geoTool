import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Ensure env vars are available when imported from apps with different CWDs
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env')
];

for (const envPath of candidateEnvFiles) {
  try {
    if (fs.existsSync(envPath)) {
      loadEnv({ path: envPath, override: false });
    }
  } catch {
    // ignore
  }
}

export const prisma = new PrismaClient();

export type { Prisma } from '@prisma/client';
export * from './services.js';
export * from './run.js';
