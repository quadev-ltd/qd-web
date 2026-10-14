import {
  deleteAccount,
  getCurrentSessionUser,
  refreshUser,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  subscribeToAuthState,
} from './auth';
import { getClaims } from './claims';
import { getFlagOverrides, getRemoteFlags } from './flags';
import { createProfileIfMissing, saveProfile, watchProfile } from './profile';

import { type AuthGateway } from '@/core/auth/gateway';
import { getReauthMethod } from '@/core/auth/reauth';

/**
 * The auth gateway backed by Firebase Authentication and Firestore: the module functions of
 * this folder, which have the names of the app's service layer (qd-mobile src/core/firebase).
 *
 * It is loaded with a dynamic import, only when the account screens are on and
 * VITE_AUTH_GATEWAY=firebase (src/core/auth/selectAuthGateway.ts). This folder is the only
 * one allowed to import `firebase/*`, and only that file may import this folder (lint rules).
 */
export const createFirebaseGateway = (): AuthGateway => ({
  subscribeToAuthState,
  getCurrentSessionUser,
  watchProfile,
  createProfileIfMissing,
  saveProfile,
  getClaims,
  getFlagOverrides,
  getRemoteFlags,
  signUpWithEmail,
  signInWithEmail,
  sendVerificationEmail,
  refreshUser,
  sendPasswordReset,
  signInWithGoogle,
  signInWithApple,
  signOut,
  getReauthMethod,
  deleteAccount,
});

export default createFirebaseGateway;
