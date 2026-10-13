import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CLIENT_ORIGIN: z.url(),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// connection string'),
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'must look like 30s, 15m, 2h or 1d')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    // Whether the refresh cookie is https-only. Unset means: yes in production, no otherwise.
    COOKIE_SECURE: z.stringbool().optional(),
    // Only read by `npm run seed`: the demo account it creates.
    SEED_EMAIL: z.email().default('demo@profithq.dev'),
    SEED_PASSWORD: z.string().min(10).max(128).default('demo-password-123'),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    message: 'must differ from JWT_ACCESS_SECRET',
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Logger depends on env, so report with console and fail fast.
    console.error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const cookieSecure = env.COOKIE_SECURE ?? isProduction;
