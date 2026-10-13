import { z } from 'zod';

import { envSchema, parseEnv } from './env';

const valid = {
  APPLICATION_NAME: 'web',
  APPLICATION_ENVIRONMENT: 'test',
};

describe('env', () => {
  it('turns off the code generation of zod, which the Content-Security-Policy forbids', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('accepts the three application environments', () => {
    for (const environment of ['test', 'dev', 'prod']) {
      expect(
        parseEnv({ ...valid, APPLICATION_ENVIRONMENT: environment })
          .APPLICATION_ENVIRONMENT,
      ).toBe(environment);
    }
  });

  it('turns the account flag off when it is not set', () => {
    expect(parseEnv(valid).ACCOUNT_ENABLED).toBe(false);
  });

  it('turns the account flag off when it is empty or "false"', () => {
    expect(parseEnv({ ...valid, ACCOUNT_ENABLED: '' }).ACCOUNT_ENABLED).toBe(
      false,
    );
    expect(
      parseEnv({ ...valid, ACCOUNT_ENABLED: 'false' }).ACCOUNT_ENABLED,
    ).toBe(false);
  });

  it('turns the account flag on only when it is "true"', () => {
    expect(
      parseEnv({ ...valid, ACCOUNT_ENABLED: 'true' }).ACCOUNT_ENABLED,
    ).toBe(true);
  });

  it('rejects an account flag that is not "true" or "false"', () => {
    expect(
      envSchema.safeParse({ ...valid, ACCOUNT_ENABLED: 'yes' }).success,
    ).toBe(false);
  });

  it('uses the unavailable auth gateway unless another one is asked for', () => {
    expect(parseEnv(valid).AUTH_GATEWAY).toBe('unavailable');
    expect(parseEnv({ ...valid, AUTH_GATEWAY: '' }).AUTH_GATEWAY).toBe(
      'unavailable',
    );
    expect(
      parseEnv({ ...valid, AUTH_GATEWAY: 'unavailable' }).AUTH_GATEWAY,
    ).toBe('unavailable');
    expect(parseEnv({ ...valid, AUTH_GATEWAY: 'preview' }).AUTH_GATEWAY).toBe(
      'preview',
    );
  });

  it('rejects an auth gateway it does not know', () => {
    expect(
      envSchema.safeParse({ ...valid, AUTH_GATEWAY: 'supabase' }).success,
    ).toBe(false);
  });

  describe('the Firebase gateway', () => {
    const firebase = {
      FIREBASE_API_KEY: 'key',
      FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
      FIREBASE_PROJECT_ID: 'demo',
      FIREBASE_APP_ID: '1:1:web:1',
    };

    it('is accepted with its four settings', () => {
      expect(
        parseEnv({ ...valid, AUTH_GATEWAY: 'firebase', ...firebase }),
      ).toMatchObject({ AUTH_GATEWAY: 'firebase', ...firebase });
    });

    it('names every setting that is missing or empty', () => {
      expect(() =>
        parseEnv({
          ...valid,
          AUTH_GATEWAY: 'firebase',
          FIREBASE_API_KEY: 'key',
          FIREBASE_PROJECT_ID: ' ',
        }),
      ).toThrow(
        /FIREBASE_AUTH_DOMAIN[\s\S]*FIREBASE_PROJECT_ID[\s\S]*FIREBASE_APP_ID/,
      );
    });

    it('does not ask for the settings with another gateway', () => {
      const env = parseEnv({ ...valid, AUTH_GATEWAY: 'preview' });

      expect(env.FIREBASE_API_KEY).toBeUndefined();
      expect(env.USE_FIREBASE_EMULATORS).toBe(false);
    });

    it('uses the emulators only when asked to', () => {
      expect(
        parseEnv({ ...valid, USE_FIREBASE_EMULATORS: 'true' })
          .USE_FIREBASE_EMULATORS,
      ).toBe(true);
      expect(
        parseEnv({ ...valid, USE_FIREBASE_EMULATORS: 'false' })
          .USE_FIREBASE_EMULATORS,
      ).toBe(false);
      expect(
        envSchema.safeParse({ ...valid, USE_FIREBASE_EMULATORS: '1' }).success,
      ).toBe(false);
    });

    it('refuses the emulators in production', () => {
      expect(() =>
        parseEnv({
          ...valid,
          APPLICATION_ENVIRONMENT: 'prod',
          USE_FIREBASE_EMULATORS: 'true',
        }),
      ).toThrow(/USE_FIREBASE_EMULATORS/);
    });
  });

  describe('the storage bucket', () => {
    it('is optional, and empty means none', () => {
      expect(parseEnv(valid).FIREBASE_STORAGE_BUCKET).toBeUndefined();
      expect(
        parseEnv({ ...valid, FIREBASE_STORAGE_BUCKET: '  ' })
          .FIREBASE_STORAGE_BUCKET,
      ).toBeUndefined();
    });

    it('is read when it is set', () => {
      expect(
        parseEnv({
          ...valid,
          FIREBASE_STORAGE_BUCKET: 'quadevapp-dev.firebasestorage.app',
        }).FIREBASE_STORAGE_BUCKET,
      ).toBe('quadevapp-dev.firebasestorage.app');
    });
  });

  describe('App Check', () => {
    it('has no site key and no debug token by default', () => {
      const unset = parseEnv(valid);
      expect(unset.RECAPTCHA_SITE_KEY).toBeUndefined();
      expect(unset.APPCHECK_DEBUG_TOKEN).toBeUndefined();

      const empty = parseEnv({
        ...valid,
        RECAPTCHA_SITE_KEY: ' ',
        APPCHECK_DEBUG_TOKEN: '',
      });
      expect(empty.RECAPTCHA_SITE_KEY).toBeUndefined();
      expect(empty.APPCHECK_DEBUG_TOKEN).toBeUndefined();
    });

    it('reads the site key and, outside production, the debug token', () => {
      expect(
        parseEnv({
          ...valid,
          APPLICATION_ENVIRONMENT: 'dev',
          RECAPTCHA_SITE_KEY: 'site-key',
          APPCHECK_DEBUG_TOKEN: 'debug-token',
        }),
      ).toMatchObject({
        RECAPTCHA_SITE_KEY: 'site-key',
        APPCHECK_DEBUG_TOKEN: 'debug-token',
      });
    });

    it('refuses a debug token in production', () => {
      expect(() =>
        parseEnv({
          ...valid,
          APPLICATION_ENVIRONMENT: 'prod',
          APPCHECK_DEBUG_TOKEN: 'debug-token',
        }),
      ).toThrow(/APPCHECK_DEBUG_TOKEN/);
    });
  });

  it('throws naming the invalid variables', () => {
    expect(() => parseEnv({ APPLICATION_ENVIRONMENT: 'staging' })).toThrow(
      /Invalid config variables:[\s\S]*APPLICATION_NAME[\s\S]*APPLICATION_ENVIRONMENT/,
    );
  });

  it('reads the test configuration from .env.test', async () => {
    const { env } = await import('./env');

    expect(env).toEqual({
      APPLICATION_NAME: 'web',
      APPLICATION_ENVIRONMENT: 'test',
      ACCOUNT_ENABLED: false,
      AUTH_GATEWAY: 'unavailable',
      FIREBASE_API_KEY: undefined,
      FIREBASE_AUTH_DOMAIN: undefined,
      FIREBASE_PROJECT_ID: undefined,
      FIREBASE_APP_ID: undefined,
      USE_FIREBASE_EMULATORS: false,
      RECAPTCHA_SITE_KEY: undefined,
      APPCHECK_DEBUG_TOKEN: undefined,
    });
  });
});
