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

// Singleton pattern for Prisma Client to prevent connection pool exhaustion
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Helper to add connection pool parameters to DATABASE_URL if not present
function getDatabaseUrlWithPool(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  
  // If connection_limit is already in the URL, return as-is
  if (url.includes('connection_limit') || url.includes('pool_timeout')) {
    return url;
  }
  
  // Add connection pool parameters to prevent too many connections
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=5&pool_timeout=10`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrlWithPool()
      }
    }
  });

// Ensure we reuse the same instance across hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
  
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

export type { Prisma } from '@prisma/client';
export * from './services.js';
export * from './run.js';
export { getConfigInfo } from './services.js';
