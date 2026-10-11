import {
  type Claims,
  type ProviderNames,
  type SessionUser,
  type SSOSignInResult,
  type UserProfile,
} from './types';

/**
 * The boundary between the account screens and whatever signs users in.
 *
 * The functions have the same names and signatures as the mobile service layer
 * (qd-mobile src/core/firebase): `auth.ts` for the session and the sign-in actions,
 * `profile.ts` for `watchProfile` and `createProfileIfMissing`, `claims.ts` for
 * `getClaims`. The mobile app imports them as module functions; the website receives
 * them through this interface (AuthGatewayProvider), so the implementation can change
 * without touching a screen:
 *
 * - `unavailableGateway`: the default. Nobody is signed in and every action fails with
 *   "not available yet".
 * - `previewGateway`: an in-memory fake for local preview and tests only.
 * - later, a `firebaseGateway` (the only folder allowed to import `firebase/*`).
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
  getClaims(forceRefresh?: boolean): Promise<Claims>;

  // ---------- Email and password ----------

  signUpWithEmail(
    email: string,
    password: string,
    profile: UserProfile,
  ): Promise<SessionUser>;
  signInWithEmail(email: string, password: string): Promise<SessionUser>;
  /**
   * With email enumeration protection, this resolves even when no account exists, so the UI
   * always shows the same neutral message.
   */
  sendPasswordReset(email: string): Promise<void>;

  // ---------- Google and Apple ----------

  /** Resolves `null` when the user closes the Google account picker. */
  signInWithGoogle(): Promise<SSOSignInResult | null>;
  signInWithApple(): Promise<SSOSignInResult>;

  // ---------- Sign out ----------

  signOut(): Promise<void>;
}
