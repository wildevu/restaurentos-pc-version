import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_PATH: z.string().default('local_hub.db'),
  SEED_DB: z.string().optional(),
});

export const config = envSchema.parse(process.env);
