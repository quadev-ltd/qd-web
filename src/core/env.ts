import { z } from 'zod';

// zod speeds up object parsing by generating code with `new Function`, and probes whether
// the page allows that as soon as an object schema is created. The site's
// Content-Security-Policy (firebase.json) has no 'unsafe-eval', and a browser reports even
// the probe as a violation. `jitless` turns both off. It is set here, before the first
// schema: this module is the first one of the application to create a zod object.
z.config({ jitless: true });

export const ApplicationEnvironentEnum = z.enum(['test', 'dev', 'prod']);

export const AuthGatewayEnum = z.enum(['unavailable', 'preview', 'firebase']);

// "true" is on; "false", empty and not set are off.
const switchSchema = z
  .enum(['true', 'false', ''])
  .optional()
  .transform(value => value === 'true');

// Empty and not set are the same: no value.
const optionalText = z
  .string()
  .optional()
  .transform(value => value?.trim() || undefined);

/** The settings of the Firebase web app. Public identifiers, not secrets. */
export const FIREBASE_SETTINGS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
] as const;

export const envSchema = z
  .object({
    APPLICATION_NAME: z.string(),
    APPLICATION_ENVIRONMENT: ApplicationEnvironentEnum,
    // "true" shows the account entry points (sign in, sign up) and registers their routes.
    // Off in production until the account backend is ready for it (README).
    ACCOUNT_ENABLED: switchSchema,
    // What answers the account screens (src/core/auth). "unavailable" (the default): every
    // action fails with "not available yet". "preview": an in-memory fake, for local preview
    // and tests only; a production build refuses it (vite.config.ts). "firebase": Firebase
    // Authentication and Firestore (src/core/firebase), which needs the settings below.
    AUTH_GATEWAY: z
      .enum([...AuthGatewayEnum.options, ''])
      .optional()
      .transform(value => value || AuthGatewayEnum.enum.unavailable),
    // From the Firebase console (Project settings, Your apps, the web app).
    FIREBASE_API_KEY: optionalText,
    FIREBASE_AUTH_DOMAIN: optionalText,
    FIREBASE_PROJECT_ID: optionalText,
    FIREBASE_APP_ID: optionalText,
    // "true" sends the Firebase gateway to the local emulators of quadev-backend instead of
    // a real project. Never in production.
    USE_FIREBASE_EMULATORS: switchSchema,
    // App Check (src/core/firebase/appCheck.ts): the backend's functions refuse a call that
    // does not prove it comes from this site. The site key of the project's reCAPTCHA
    // Enterprise key is a public identifier. Without it App Check is not started.
    RECAPTCHA_SITE_KEY: optionalText,
    // A SECRET, for `yarn start:dev` on a developer's machine only (.env.dev.local): it stands
    // in for reCAPTCHA, which only answers on the site's own domain. vite.config.ts removes
    // it from every build, and it is refused in production.
    APPCHECK_DEBUG_TOKEN: optionalText,
  })
  .superRefine((value, context) => {
    if (value.AUTH_GATEWAY === AuthGatewayEnum.enum.firebase) {
      for (const key of FIREBASE_SETTINGS) {
        if (!value[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required when AUTH_GATEWAY is "firebase"',
          });
        }
      }
    }
    if (
      value.USE_FIREBASE_EMULATORS &&
      value.APPLICATION_ENVIRONMENT === ApplicationEnvironentEnum.enum.prod
    ) {
      context.addIssue({
        code: 'custom',
        path: ['USE_FIREBASE_EMULATORS'],
        message: 'The emulators are not allowed in production',
      });
    }
    if (
      value.APPCHECK_DEBUG_TOKEN &&
      value.APPLICATION_ENVIRONMENT === ApplicationEnvironentEnum.enum.prod
    ) {
      context.addIssue({
        code: 'custom',
        path: ['APPCHECK_DEBUG_TOKEN'],
        message: 'An App Check debug token is not allowed in production',
      });
    }
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
  FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  USE_FIREBASE_EMULATORS: import.meta.env.VITE_USE_FIREBASE_EMULATORS,
  RECAPTCHA_SITE_KEY: import.meta.env.VITE_RECAPTCHA_SITE_KEY,
  APPCHECK_DEBUG_TOKEN: import.meta.env.VITE_APPCHECK_DEBUG_TOKEN,
});
