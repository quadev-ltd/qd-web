import { z } from 'zod';

export const ApplicationEnvironentEnum = z.enum(['test', 'dev', 'prod']);

export const envSchema = z.object({
  APPLICATION_NAME: z.string(),
  APPLICATION_ENVIRONMENT: ApplicationEnvironentEnum,
  // "true" shows the account entry points (sign in, sign up) and registers their routes.
  // Off in production until the account backend is connected.
  ACCOUNT_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform(value => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

// validate config variables
export const parseEnv = (config: unknown): Env => {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorMessage = `Invalid config variables: ${JSON.stringify(
      z.flattenError(parsed.error).fieldErrors,
      null,
      2,
    )}`;
    throw new Error(errorMessage);
  }
  return parsed.data;
};

// Vite inlines VITE_* variables at build time, which only works with static
// dot access (no destructuring or computed keys).
export const env = parseEnv({
  APPLICATION_NAME: import.meta.env.VITE_APPLICATION_NAME,
  APPLICATION_ENVIRONMENT: import.meta.env.VITE_APPLICATION_ENVIRONMENT,
  ACCOUNT_ENABLED: import.meta.env.VITE_ACCOUNT_ENABLED,
});
