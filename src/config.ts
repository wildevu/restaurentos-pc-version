import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_PATH: z.string().default('restaurantos.db'),
  SEED_DB: z.string().optional(),
  FOUNDER_UPGRADE_URL: z.string().default('https://restos-crm-platform.vercel.app/upgrade'),
  FOUNDER_UPLOAD_URL: z.string().default('https://restos-crm-platform.vercel.app/upload'),
});

export const config = envSchema.parse(process.env);
