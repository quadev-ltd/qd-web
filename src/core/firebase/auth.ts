// The web version of qd-mobile src/core/firebase/auth.ts: the same function names and the
// same order of operations. What differs on the web:
// - Google signs in through a browser window (`signInWithPopup`); the app uses the native
//   Google SDK and hands Firebase a credential.
// - Apple is not set up for the web yet (it needs a Services ID in the Apple Developer
//   account), so `signInWithApple` is not available and an Apple account cannot confirm
//   a deletion here.
// - The verification email carries the address of the site, so the page that confirms the
//   email can send the user back.
import {
  type ActionCodeSettings,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAdditionalUserInfo,
  getIdToken,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth';

import { auth } from './app';
import { createProfile } from './profile';

import {
  ACCOUNT_UNAVAILABLE,
  AppAuthError,
  isPopupCancellation,
  logAuthError,
  NO_CURRENT_USER,
  SIGN_IN_CANCELLED,
} from '@/core/auth/errors';
import { VERIFY_EMAIL_PATH } from '@/core/auth/paths';
import { getReauthMethod } from '@/core/auth/reauth';
import {
  type ProviderNames,
  type SessionUser,
  type SSOSignInResult,
  type UserProfile,
} from '@/core/auth/types';

// ---------- Session ----------

export const toSessionUser = (user: User): SessionUser => ({
  uid: user.uid,
  email: user.email,
  emailVerified: user.emailVerified,
  displayName: user.displayName,
  providerIds: (user.providerData ?? []).map(info => info.providerId),
});

/** Calls `listener` now and on every sign-in / sign-out. Returns the unsubscribe function. */
export const subscribeToAuthState = (
  listener: (user: SessionUser | null) => void,
): (() => void) =>
  onAuthStateChanged(auth(), user =>
    listener(user ? toSessionUser(user) : null),
  );

export const getCurrentSessionUser = (): SessionUser | null => {
  const user = auth().currentUser;
  return user ? toSessionUser(user) : null;
};

const requireCurrentUser = (): User => {
  const user = auth().currentUser;
  if (!user) {
    throw new AppAuthError(NO_CURRENT_USER);
  }
  return user;
};

// ---------- Email and password ----------

/**
 * Where "Continue" on the page that confirms the email leads: the verify-email page of the
 * site the user signed up on. Firebase refuses an address whose domain is not in the
 * project's authorised domains (`auth/unauthorized-continue-uri`).
 */
const verificationEmailSettings = (): ActionCodeSettings => ({
  url: `${window.location.origin}${VERIFY_EMAIL_PATH}`,
});

/**
 * Creates the account, writes the profile and sends the verification email. The account is the
 * only step that must succeed: a failed profile write is completed later on the complete-profile
 * page, and the email can be resent from the verify-email page.
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  profile: UserProfile,
): Promise<SessionUser> => {
  const { user } = await createUserWithEmailAndPassword(
    auth(),
    email,
    password,
  );
  try {
    await createProfile(user.uid, profile);
  } catch (error) {
    logAuthError('createProfile', error, user.uid);
  }
  try {
    await sendEmailVerification(user, verificationEmailSettings());
  } catch (error) {
    logAuthError('sendEmailVerification', error, user.uid);
  }
  return toSessionUser(user);
};

export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<SessionUser> => {
  const { user } = await signInWithEmailAndPassword(auth(), email, password);
  return toSessionUser(user);
};

export const sendVerificationEmail = async () => {
  await sendEmailVerification(
    requireCurrentUser(),
    verificationEmailSettings(),
  );
};

/**
 * Reloads the user (to see `emailVerified` after the hosted verification page) and forces a new
 * ID token, so Firestore rules and custom claims see the change. Returns the updated user.
 */
export const refreshUser = async (): Promise<SessionUser | null> => {
  const user = requireCurrentUser();
  await reload(user);
  await getIdToken(auth().currentUser ?? user, true);
  return getCurrentSessionUser();
};

/**
 * With email enumeration protection on, this resolves even when no account exists, so the UI
 * always shows the same neutral message.
 */
export const sendPasswordReset = async (email: string) => {
  await sendPasswordResetEmail(auth(), email);
};

// ---------- Google and Apple ----------

/** `loginHint` preselects that account in the Google window. */
const googleProvider = (loginHint?: string | null) => {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser, as the app does, even with one Google session.
  provider.setCustomParameters({
    prompt: 'select_account',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return provider;
};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * The names Google shares at sign-in. Without them (some accounts have one name only), the
 * display name is split at the first space; what is still missing is asked on the
 * complete-profile page.
 */
const googleNames = (credential: UserCredential): ProviderNames => {
  const profile = getAdditionalUserInfo(credential)?.profile;
  const [first, ...rest] = (credential.user.displayName ?? '')
    .trim()
    .split(/\s+/);
  const firstName = text(profile?.given_name) ?? text(first);
  const lastName = text(profile?.family_name) ?? text(rest.join(' '));
  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
};

/** Resolves `null` when the user closes the Google window. */
export const signInWithGoogle = async (): Promise<SSOSignInResult | null> => {
  let credential: UserCredential;
  try {
    credential = await signInWithPopup(auth(), googleProvider());
  } catch (error) {
    if (isPopupCancellation(error)) {
      return null;
    }
    throw error;
  }
  return {
    user: toSessionUser(credential.user),
    names: googleNames(credential),
  };
};

/** Not set up for the web yet; the screens do not show the button (src/core/sso). */
export const signInWithApple = (): Promise<SSOSignInResult> =>
  Promise.reject(new AppAuthError(ACCOUNT_UNAVAILABLE));

// ---------- Sign out and delete ----------

/** Safe to call when already signed out. */
export const signOut = async () => {
  await firebaseSignOut(auth());
};

const reauthenticateWithGoogle = async (user: User) => {
  try {
    await reauthenticateWithPopup(user, googleProvider(user.email));
  } catch (error) {
    if (isPopupCancellation(error)) {
      throw new AppAuthError(SIGN_IN_CANCELLED);
    }
    throw error;
  }
};

/**
 * Deletes the Firebase account. The backend's `onUserDeleted` then deletes `users/{uid}`, and
 * Firebase signs the user out.
 * - Google: always confirms in a Google window first. The app deletes first and asks only
 *   when Firebase wants a recent sign-in; a browser blocks a window that opens after a
 *   network answer instead of straight after the click, so the website asks first.
 * - Password, with `password`: checks it, then deletes.
 * - Password, without it: tries to delete; `auth/requires-recent-login` is passed to the
 *   caller, which asks for the password and calls again with it.
 */
export const deleteAccount = async (
  options: { password?: string } = {},
): Promise<void> => {
  const user = requireCurrentUser();
  const method = getReauthMethod(toSessionUser(user));

  if (method === 'google') {
    await reauthenticateWithGoogle(user);
  } else if (method === 'password' && options.password) {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email ?? '', options.password),
    );
  }
  await deleteUser(user);
};
