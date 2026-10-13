import { type FirebaseApp } from 'firebase/app';
import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';

import { resetAppCheckForTests, startAppCheck } from './appCheck';

const testEnv = vi.hoisted(() => ({
  RECAPTCHA_SITE_KEY: 'site-key' as string | undefined,
  APPCHECK_DEBUG_TOKEN: undefined as string | undefined,
  USE_FIREBASE_EMULATORS: false,
}));
const logMessage = vi.hoisted(() => vi.fn());

vi.mock('@/core/env', () => ({ env: testEnv }));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage })),
}));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(() => ({ name: 'app-check' })),
  ReCaptchaEnterpriseProvider: vi.fn(function Provider(
    this: { siteKey: string },
    siteKey: string,
  ) {
    this.siteKey = siteKey;
  }),
  CustomProvider: vi.fn(function Provider(
    this: { getToken: unknown },
    options: { getToken: unknown },
  ) {
    this.getToken = options.getToken;
  }),
}));

const firebaseApp = {
  name: 'app',
  options: { appId: '1:1:web:1' },
} as FirebaseApp;

beforeEach(() => {
  vi.clearAllMocks();
  resetAppCheckForTests();
  testEnv.RECAPTCHA_SITE_KEY = 'site-key';
  testEnv.APPCHECK_DEBUG_TOKEN = undefined;
  testEnv.USE_FIREBASE_EMULATORS = false;
});

describe('app check', () => {
  it('starts with reCAPTCHA Enterprise and the site key, and keeps the token fresh', () => {
    expect(startAppCheck(firebaseApp)).toEqual({ name: 'app-check' });

    expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('site-key');
    expect(initializeAppCheck).toHaveBeenCalledWith(firebaseApp, {
      provider: { siteKey: 'site-key' },
      isTokenAutoRefreshEnabled: true,
    });
  });

  it('starts once', () => {
    const first = startAppCheck(firebaseApp);
    const second = startAppCheck(firebaseApp);

    expect(second).toBe(first);
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it('does not start without a site key', () => {
    testEnv.RECAPTCHA_SITE_KEY = undefined;
    testEnv.APPCHECK_DEBUG_TOKEN = 'debug-token';

    expect(startAppCheck(firebaseApp)).toBeUndefined();
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('uses no debug token by default', () => {
    startAppCheck(firebaseApp);

    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
    expect(logMessage).not.toHaveBeenCalled();
  });

  it('hands the debug token to the SDK before App Check starts, and says so', () => {
    testEnv.APPCHECK_DEBUG_TOKEN = 'debug-token';
    vi.mocked(initializeAppCheck).mockImplementationOnce(() => {
      // The SDK reads the token at this moment.
      expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('debug-token');
      return { name: 'app-check' } as never;
    });

    startAppCheck(firebaseApp);

    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(logMessage).toHaveBeenCalledWith('App Check uses a debug token.');
    // The message never contains the token.
    expect(JSON.stringify(logMessage.mock.calls)).not.toContain('debug-token');
  });

  describe('against the local emulators', () => {
    type TokenProvider = {
      getToken(): Promise<{ token: string; expireTimeMillis: number }>;
    };
    const decode = (part: string) =>
      JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<
        string,
        unknown
      >;

    beforeEach(() => {
      testEnv.USE_FIREBASE_EMULATORS = true;
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-13T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('uses a provider of its own: neither reCAPTCHA nor a debug token', () => {
      testEnv.APPCHECK_DEBUG_TOKEN = 'debug-token';

      expect(startAppCheck(firebaseApp)).toEqual({ name: 'app-check' });

      expect(CustomProvider).toHaveBeenCalledTimes(1);
      expect(ReCaptchaEnterpriseProvider).not.toHaveBeenCalled();
      expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
      expect(initializeAppCheck).toHaveBeenCalledWith(firebaseApp, {
        provider: { getToken: expect.any(Function) },
        isTokenAutoRefreshEnabled: true,
      });
    });

    it('works without a site key', () => {
      testEnv.RECAPTCHA_SITE_KEY = undefined;

      expect(startAppCheck(firebaseApp)).toEqual({ name: 'app-check' });
    });

    it('gives the unsigned token the Functions emulator accepts, good for an hour', async () => {
      startAppCheck(firebaseApp);
      const [, { provider }] = vi.mocked(initializeAppCheck).mock.calls[0];

      const { token, expireTimeMillis } = await (
        provider as unknown as TokenProvider
      ).getToken();

      const now = Date.parse('2026-10-13T10:00:00Z') / 1000;
      const [header, payload, signature] = token.split('.');
      expect(decode(header)).toEqual({ alg: 'none', typ: 'JWT' });
      expect(decode(payload)).toEqual({
        sub: '1:1:web:1',
        iat: now,
        exp: now + 3600,
      });
      // No signature: a deployed function refuses this token.
      expect(signature).toBe('');
      expect(token).not.toMatch(/[+/=]/);
      expect(expireTimeMillis).toBe((now + 3600) * 1000);
    });
  });
});
