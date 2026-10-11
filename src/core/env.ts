import { z } from 'zod';

export const ApplicationEnvironentEnum = z.enum(['test', 'dev', 'prod']);

export const AuthGatewayEnum = z.enum(['unavailable', 'preview']);

export const envSchema = z.object({
  APPLICATION_NAME: z.string(),
  APPLICATION_ENVIRONMENT: ApplicationEnvironentEnum,
  // "true" shows the account entry points (sign in, sign up) and registers their routes.
  // Off in production until the account backend is connected.
  ACCOUNT_ENABLED: z
    .enum(['true', 'false', ''])
    .optional()
    .transform(value => value === 'true'),
  // What answers the account screens (src/core/auth). "unavailable" (the default): every
  // action fails with "not available yet". "preview": an in-memory fake, for local preview
  // and tests only; a production build refuses it (vite.config.ts).
  AUTH_GATEWAY: z
    .enum([...AuthGatewayEnum.options, ''])
    .optional()
    .transform(value =>
      value === AuthGatewayEnum.enum.preview
        ? AuthGatewayEnum.enum.preview
        : AuthGatewayEnum.enum.unavailable,
    ),
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
  AUTH_GATEWAY: import.meta.env.VITE_AUTH_GATEWAY,
});
