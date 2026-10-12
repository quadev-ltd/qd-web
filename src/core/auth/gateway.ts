import {
  type Claims,
  type ProviderNames,
  type ReauthMethod,
  type SessionUser,
  type SSOSignInResult,
  type UserProfile,
} from './types';

/**
 * The boundary between the account screens and whatever signs users in.
 *
 * The functions have the same names and signatures as the mobile service layer
 * (qd-mobile src/core/firebase): `auth.ts` for the session and the account actions,
 * `profile.ts` for `watchProfile`, `createProfileIfMissing` and `saveProfile`, `claims.ts`
 * for `getClaims`. The mobile app imports them as module functions; the website receives
 * them through this interface (AuthGatewayProvider), so the implementation can change
 * without touching a screen:
 *
 * - `unavailableGateway`: the default. Nobody is signed in and every action fails with
 *   "not available yet".
 * - `previewGateway`: an in-memory fake for local preview and tests only.
 * - the Firebase gateway (`src/core/firebase`, the only folder allowed to import
 *   `firebase/*`): Firebase Authentication and the profile in Firestore.
 */
export interface AuthGateway {
  // ---------- Session ----------

  /** Calls `listener` now and on every sign-in / sign-out. Returns the unsubscribe function. */
  subscribeToAuthState(
    listener: (user: SessionUser | null) => void,
  ): () => void;
  getCurrentSessionUser(): SessionUser | null;

  // ---------- Profile and claims ----------

  /** Listens to the user's profile. `onNext(null)` means the profile does not exist. */
  watchProfile(
    uid: string,
    onNext: (profile: UserProfile | null) => void,
    onError: (error: unknown) => void,
  ): () => void;
  /**
   * After Google or Apple sign-in: creates the profile from the provider's names when there is
   * none yet. Resolves false when the names are incomplete.
   */
  createProfileIfMissing(uid: string, names: ProviderNames): Promise<boolean>;
  /** Creates the profile, or completes it if one already exists. */
  saveProfile(uid: string, profile: UserProfile): Promise<void>;
  getClaims(forceRefresh?: boolean): Promise<Claims>;

  // ---------- Email and password ----------

  signUpWithEmail(
    email: string,
    password: string,
    profile: UserProfile,
  ): Promise<SessionUser>;
  signInWithEmail(email: string, password: string): Promise<SessionUser>;
  /** Sends the verification email again to the signed-in user. */
  sendVerificationEmail(): Promise<void>;
  /**
   * Asks the backend for the user again (to see `emailVerified` after the link in the email
   * was opened) and renews the session token. Resolves the updated user: the caller puts it
   * in the session (`authStateChanged`), because no auth-state event follows.
   */
  refreshUser(): Promise<SessionUser | null>;
  /**
   * With email enumeration protection, this resolves even when no account exists, so the UI
   * always shows the same neutral message.
   */
  sendPasswordReset(email: string): Promise<void>;

  // ---------- Google and Apple ----------

  /** Resolves `null` when the user closes the Google account picker. */
  signInWithGoogle(): Promise<SSOSignInResult | null>;
  signInWithApple(): Promise<SSOSignInResult>;

  // ---------- Sign out and delete ----------

  signOut(): Promise<void>;
  /**
   * How this user proves who they are before deleting the account; `null` when the website
   * has no way to ask (an Apple-only account, until Apple sign-in is set up on the web).
   */
  getReauthMethod(user: SessionUser): ReauthMethod | null;
  /**
   * Deletes the signed-in account; the backend then removes the profile.
   * - `google`: asks the user to confirm in a Google window first. Rejects with
   *   SIGN_IN_CANCELLED when they close it, and with `auth/user-mismatch` when they pick
   *   another account.
   * - `password`, with `password`: checks the password first.
   * - `password`, without it: tries at once and rejects with `auth/requires-recent-login`
   *   when the sign-in is too old; the caller then asks for the password and calls again.
   */
  deleteAccount(options?: { password?: string }): Promise<void>;
}
