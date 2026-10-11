// Mirrors qd-mobile src/core/sso/useSSOSignIn.ts: the same steps and the same session actions.
// The app shows a failure as a toast; here it is handed to `setErrorMessage`, which the
// screen shows in the page.
import { useTranslation } from 'react-i18next';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import {
  getErrorCode,
  getErrorMessageKey,
  logAuthError,
  SIGN_IN_CANCELLED,
} from '@/core/auth/errors';
import { type SSOSignInResult } from '@/core/auth/types';
import { useAppDispatch } from '@/core/state/hooks';
import {
  profileSetupFinished,
  profileSetupStarted,
  providerNamesReceived,
} from '@/core/state/slices/sessionSlice';

interface UseSSOSignInOptions {
  provider: 'google' | 'apple';
  setIsLoading: (isLoading: boolean) => void;
  setErrorMessage: (message: string | undefined) => void;
  /** Resolves `null` when the user cancels. */
  signIn: () => Promise<SSOSignInResult | null>;
}

const isCancellation = (error: unknown) =>
  getErrorCode(error) === SIGN_IN_CANCELLED;

/**
 * Google / Apple sign-in. A new user gets a profile from the provider's names (no date of
 * birth). When the names are missing (Apple shares them only once), the session asks for
 * them (SessionStatus.NeedsProfile).
 */
export function useSSOSignIn({
  provider,
  setIsLoading,
  setErrorMessage,
  signIn,
}: UseSSOSignInOptions) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const gateway = useAuthGateway();

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    // Holds the session on the loading screen until the profile exists, so an incomplete
    // profile does not flash for a new user.
    dispatch(profileSetupStarted());
    let uid: string | undefined;
    try {
      const result = await signIn();
      if (!result) {
        return;
      }
      uid = result.user.uid;
      dispatch(providerNamesReceived(result.names));
      await gateway.createProfileIfMissing(uid, result.names);
    } catch (error) {
      if (isCancellation(error)) {
        return;
      }
      logAuthError(`${provider}SignIn`, error, uid);
      // Signed in but the profile write failed: the session takes over, no message needed.
      if (!uid) {
        setErrorMessage(t(getErrorMessageKey(error)));
      }
    } finally {
      dispatch(profileSetupFinished());
      setIsLoading(false);
    }
  };

  return { handleSignIn };
}
