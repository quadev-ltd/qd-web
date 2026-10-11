// Mirrors qd-mobile src/core/session/SessionProvider.tsx: the same listeners and the same
// actions. The mobile app calls the Firebase service functions; here they come from the
// auth gateway.
import { type ReactNode, useEffect } from 'react';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import { logAuthError } from '@/core/auth/errors';
import { type SessionUser } from '@/core/auth/types';
import { useAppDispatch } from '@/core/state/hooks';
import {
  authStateChanged,
  claimsChanged,
  profileFailed,
  profileLoaded,
} from '@/core/state/slices/sessionSlice';

/**
 * Keeps the `session` slice in sync with the auth gateway: the signed-in user, their profile
 * and their custom claims. Mount it once, inside the Redux Provider and AuthGatewayProvider.
 */
export const SessionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const gateway = useAuthGateway();

  useEffect(() => {
    let currentUid: string | null = null;
    let stopWatchingProfile: (() => void) | undefined;
    let stopListening: (() => void) | undefined;

    const onUser = (user: SessionUser | null) => {
      const uid = user?.uid ?? null;
      const userChanged = uid !== currentUid;
      if (userChanged) {
        stopWatchingProfile?.();
        stopWatchingProfile = undefined;
        currentUid = uid;
      }
      dispatch(authStateChanged(user));
      if (!user || !userChanged) {
        return;
      }
      stopWatchingProfile = gateway.watchProfile(
        user.uid,
        profile => dispatch(profileLoaded(profile)),
        () => {
          // A listener error after sign-out (permission denied) is expected; ignore it.
          if (gateway.getCurrentSessionUser()?.uid === user.uid) {
            dispatch(profileFailed());
          }
        },
      );
      gateway
        .getClaims()
        .then(claims => dispatch(claimsChanged(claims)))
        .catch(error => logAuthError('getClaims', error, user.uid));
    };

    try {
      stopListening = gateway.subscribeToAuthState(onUser);
    } catch (error) {
      // Never leave the site on the loading state: show the signed-out screens instead.
      logAuthError('subscribeToAuthState', error);
      dispatch(authStateChanged(null));
    }

    return () => {
      stopListening?.();
      stopWatchingProfile?.();
    };
  }, [dispatch, gateway]);

  return <>{children}</>;
};

export default SessionProvider;
