import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

// Charge le .env à la racine du projet (angular-project/.env)
// process.cwd() pointe sur backend/ au runtime (npm run dev, ts-node)
const envPath = resolve(process.cwd(), '..', '.env');
loadDotenv({ path: envPath });

const EnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Secrets JWT — générer avec : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // Redis (BullMQ)
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  // Mailhog SMTP (dev)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  // AI Provider (Sprint 3) — 'anthropic' | 'ollama'
  AI_PROVIDER: z.enum(['anthropic', 'ollama']).default('anthropic'),
  // Claude / Anthropic
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  AI_MAX_TOKENS: z.coerce.number().int().min(256).default(1024),
  // Ollama (local)
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:3b'),
  // Modèle dédié à la boucle agentique (besoin de plus de capacité que l'extraction)
  OLLAMA_AGENT_MODEL: z.string().default('qwen2.5:7b'),
  // Timeout hard de la boucle agent (ms)
  AGENT_TIMEOUT_MS: z.coerce.number().int().default(60_000),
  // Embeddings Ollama (nomic-embed-text)
  OLLAMA_EMBED_MODEL: z.string().default('nomic-embed-text'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Validation conditionnelle : clé Anthropic obligatoire si provider=anthropic
if (parsed.data.AI_PROVIDER === 'anthropic' && !parsed.data.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
