import { type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';

import { resetAppCheckForTests, startAppCheck } from './appCheck';

const testEnv = vi.hoisted(() => ({
  RECAPTCHA_SITE_KEY: 'site-key' as string | undefined,
  APPCHECK_DEBUG_TOKEN: undefined as string | undefined,
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
}));

const firebaseApp = { name: 'app' } as FirebaseApp;

beforeEach(() => {
  vi.clearAllMocks();
  resetAppCheckForTests();
  testEnv.RECAPTCHA_SITE_KEY = 'site-key';
  testEnv.APPCHECK_DEBUG_TOKEN = undefined;
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
});
