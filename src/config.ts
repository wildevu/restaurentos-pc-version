import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).default('3000'),
  DB_PATH: z.string().default('local_hub.db'),
  SEED_DB: z.string().optional(),
});

export const config = envSchema.parse(process.env);
