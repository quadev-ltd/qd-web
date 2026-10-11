// Mirrors qd-mobile src/core/session/hooks.ts.
import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import { logAuthError } from '@/core/auth/errors';
import { useAppSelector } from '@/core/state/hooks';
import {
  selectClaims,
  selectProfile,
  selectSessionStatus,
  selectSessionUser,
} from '@/core/state/selectors/session';

export const useSessionStatus = () => useAppSelector(selectSessionStatus);
export const useSessionUser = () => useAppSelector(selectSessionUser);
export const useProfile = () => useAppSelector(selectProfile);

/**
 * Whether the user has paid features (the `paid` custom claim). Nothing is gated on it yet.
 */
export const usePaidFeatures = () => useAppSelector(selectClaims).paid;

/**
 * Signs the user out, as the app's drawer does (qd-mobile DrawerContent): the session then
 * becomes signedOut and the route guard leaves the signed-in pages.
 */
export const useSignOut = () => {
  const gateway = useAuthGateway();
  const uid = useSessionUser()?.uid;

  return () => {
    gateway.signOut().catch(error => logAuthError('signOut', error, uid));
  };
};
