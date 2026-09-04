import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_PATH: z.string().default('restaurantos.db'),
  SEED_DB: z.string().optional(),
});

export const config = envSchema.parse(process.env);
