// App Check: proof, sent with every call to the backend's functions, that the call comes
// from this site. Every callable of quadev-backend refuses a call without it
// (docs/adr/0006-app-check.md).
import { type FirebaseApp } from 'firebase/app';
import {
  type AppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';

import { env } from '@/core/env';
import logger from '@/core/logger';

declare global {
  // Read by the Firebase SDK when App Check starts: with a token here it skips reCAPTCHA
  // and exchanges this token instead.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | undefined;
}

let appCheck: AppCheck | undefined;

/**
 * Starts App Check for the app, once. Returns `undefined` when the site has no reCAPTCHA
 * site key (VITE_RECAPTCHA_SITE_KEY): nothing is started, and the functions answer
 * "unauthenticated".
 *
 * On the site's own domain reCAPTCHA Enterprise vouches for the page, with no puzzle. It
 * does not answer anywhere else, so `yarn start:dev` uses a debug token registered in the
 * Firebase console (VITE_APPCHECK_DEBUG_TOKEN in .env.dev.local, never in a build).
 */
export const startAppCheck = (app: FirebaseApp): AppCheck | undefined => {
  if (appCheck) {
    return appCheck;
  }
  const siteKey = env.RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    return undefined;
  }
  if (env.APPCHECK_DEBUG_TOKEN) {
    // Must be set before App Check starts: the SDK reads it once, at that moment.
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = env.APPCHECK_DEBUG_TOKEN;
    logger().logMessage('App Check uses a debug token.');
  }
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    // The token lasts an hour; the SDK renews it while the page is open.
    isTokenAutoRefreshEnabled: true,
  });
  return appCheck;
};

/** Test helper: lets a test start again after changing the environment. */
export const resetAppCheckForTests = () => {
  appCheck = undefined;
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = undefined;
};
