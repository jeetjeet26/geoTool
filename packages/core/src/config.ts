import { z } from 'zod';

const ConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  RUN_DEFAULT_BATCH: z.coerce.number().int().positive().default(40),
  RUN_SEED: z.coerce.number().int().default(42),
  TEMPERATURE: z.coerce.number().min(0).max(1).default(0),
  TOP_P: z.coerce.number().min(0).max(1).default(1),
  OPENAI_MODEL: z.string().min(1).default('gpt-5'),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-4.5')
});

type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

export function loadConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  const parsed = ConfigSchema.safeParse({
    ...process.env,
    ...overrides
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration.\n${issues.join('\n')}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    return loadConfig();
  }

  return cachedConfig;
}
