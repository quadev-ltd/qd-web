// The web version of qd-mobile src/core/firebase/claims.ts.
import { getIdTokenResult } from 'firebase/auth';

import { auth } from './app';

import { type Claims, NO_CLAIMS } from '@/core/auth/types';

/**
 * Reads the custom claims set by the backend (`paid` by `setPaidFeatures`, `admin` by the owner).
 * A change shows after the ID token refreshes; pass `forceRefresh` to see it immediately.
 */
export const getClaims = async (forceRefresh = false): Promise<Claims> => {
  const user = auth().currentUser;
  if (!user) {
    return NO_CLAIMS;
  }
  const { claims } = await getIdTokenResult(user, forceRefresh);
  const record = claims as Record<string, unknown>;
  return { paid: record.paid === true, admin: record.admin === true };
};
