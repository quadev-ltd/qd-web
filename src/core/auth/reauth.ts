// The web version of `getReauthMethod` in qd-mobile src/core/firebase/auth.ts. A pure
// helper, shared by every gateway.
import {
  GOOGLE_PROVIDER_ID,
  PASSWORD_PROVIDER_ID,
  type ReauthMethod,
  type SessionUser,
} from './types';

/**
 * How the user proves who they are before deleting the account. The app asks an Apple user
 * to confirm with Apple (iOS only); the website has no Apple sign-in yet, so an account
 * with Apple alone gives `null` (no confirmation is possible here).
 */
export const getReauthMethod = (user: SessionUser): ReauthMethod | null => {
  if (user.providerIds.includes(GOOGLE_PROVIDER_ID)) {
    return 'google';
  }
  if (user.providerIds.includes(PASSWORD_PROVIDER_ID)) {
    return 'password';
  }
  return null;
};

export default getReauthMethod;
