import { ACCOUNT_UNAVAILABLE, AppAuthError } from './errors';
import { type AuthGateway } from './gateway';
import { NO_CLAIMS } from './types';

const unavailable = () => Promise.reject(new AppAuthError(ACCOUNT_UNAVAILABLE));

const nothingToStop = () => undefined;

/**
 * The default gateway, and the only one in a production build until the account backend is
 * connected: nobody is signed in, and every action fails with ACCOUNT_UNAVAILABLE, which the
 * screens show as "Sign-in on the web is not available yet". It makes no network request.
 */
export const unavailableGateway: AuthGateway = {
  subscribeToAuthState: listener => {
    listener(null);
    return nothingToStop;
  },
  getCurrentSessionUser: () => null,
  watchProfile: () => nothingToStop,
  createProfileIfMissing: unavailable,
  getClaims: () => Promise.resolve(NO_CLAIMS),
  signUpWithEmail: unavailable,
  signInWithEmail: unavailable,
  sendPasswordReset: unavailable,
  signInWithGoogle: unavailable,
  signInWithApple: unavailable,
  signOut: unavailable,
};

export default unavailableGateway;
