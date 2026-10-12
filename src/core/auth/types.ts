// Mirrors qd-mobile src/core/firebase/types.ts: the same shapes and helpers, so the
// session slice and the screens are the same on both platforms.
// Plain, serialisable shapes the rest of the app uses instead of Firebase classes.

export const PASSWORD_PROVIDER_ID = 'password';
export const GOOGLE_PROVIDER_ID = 'google.com';
export const APPLE_PROVIDER_ID = 'apple.com';

export interface SessionUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  providerIds: string[];
  /** When the account was created (milliseconds since the epoch), if the gateway knows. */
  createdAt?: number;
}

/** `users/{uid}` as the app sees it. `dateOfBirth` is `YYYY-MM-DD` and optional (decision D16). */
export interface UserProfile {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

/** Names shared by Google or Apple at sign-in (Apple only on the first authorisation). */
export interface ProviderNames {
  firstName?: string;
  lastName?: string;
}

export interface Claims {
  paid: boolean;
  admin: boolean;
}

export const NO_CLAIMS: Claims = { paid: false, admin: false };

/** How a user proves who they are before deleting the account (`getReauthMethod`). */
export type ReauthMethod = 'password' | 'google' | 'apple';

/** What a Google or Apple sign-in returns (qd-mobile src/core/firebase/auth.ts). */
export interface SSOSignInResult {
  user: SessionUser;
  names: ProviderNames;
}

// Pure helpers, shared by the gateways and the session slice.

/** Google and Apple confirm the email themselves; only email/password users must verify it. */
export const isVerifiedUser = (user: SessionUser): boolean =>
  user.emailVerified ||
  user.providerIds.some(
    id => id === GOOGLE_PROVIDER_ID || id === APPLE_PROVIDER_ID,
  );

export const hasCompleteNames = (
  profile?: Partial<UserProfile> | null,
): boolean => Boolean(profile?.firstName?.trim() && profile?.lastName?.trim());
