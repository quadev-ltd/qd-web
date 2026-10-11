import { AppAuthError, AuthErrorCode } from './errors';
import { type AuthGateway } from './gateway';
import {
  APPLE_PROVIDER_ID,
  GOOGLE_PROVIDER_ID,
  hasCompleteNames,
  NO_CLAIMS,
  PASSWORD_PROVIDER_ID,
  type SessionUser,
  type SSOSignInResult,
  type UserProfile,
} from './types';

/**
 * An in-memory fake of the account backend, for local preview and tests ONLY.
 *
 * It is never part of a production build: it is loaded with a dynamic import that the
 * bundler removes unless VITE_AUTH_GATEWAY=preview (src/core/auth/selectAuthGateway.ts), a
 * production build with that value fails (vite.config.ts), and `yarn check:bundle` looks
 * for PREVIEW_GATEWAY_MARKER in the built files.
 *
 * It knows one sample account (PREVIEW_USER) and the accounts created with the sign-up form.
 * They live in memory and in sessionStorage, so reloading the page keeps the session and
 * closing the tab forgets everything. Nothing is sent anywhere. Never type a real password.
 */
export const PREVIEW_GATEWAY_MARKER = 'qd-preview-gateway';

/** The sample account. It is documented in the README; it is not a secret. */
export const PREVIEW_USER = {
  email: 'preview@example.com',
  password: 'Preview123!',
  profile: { firstName: 'Ada', lastName: 'Lovelace' },
} as const;

interface PreviewAccount {
  uid: string;
  email: string;
  password: string;
  providerIds: string[];
  profile: UserProfile;
}

interface PreviewState {
  accounts: PreviewAccount[];
  currentUid: string | null;
}

/** The part of the Web Storage API the gateway needs (sessionStorage, or a fake in tests). */
export type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>;

const SEEDED_ACCOUNT: PreviewAccount = {
  uid: 'preview-user',
  email: PREVIEW_USER.email,
  password: PREVIEW_USER.password,
  providerIds: [PASSWORD_PROVIDER_ID, GOOGLE_PROVIDER_ID, APPLE_PROVIDER_ID],
  profile: { ...PREVIEW_USER.profile },
};

const browserStorage = (): PreviewStorage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    // Storage can be blocked (private mode, embedded pages): memory only.
    return null;
  }
};

const readState = (storage: PreviewStorage | null): PreviewState => {
  const empty: PreviewState = { accounts: [], currentUid: null };
  try {
    const stored = storage?.getItem(PREVIEW_GATEWAY_MARKER);
    if (!stored) {
      return empty;
    }
    const parsed = JSON.parse(stored) as Partial<PreviewState>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      currentUid:
        typeof parsed.currentUid === 'string' ? parsed.currentUid : null,
    };
  } catch {
    return empty;
  }
};

const toSessionUser = (account: PreviewAccount): SessionUser => ({
  uid: account.uid,
  email: account.email,
  // There is no verification step in the preview: every account counts as verified.
  emailVerified: true,
  displayName: null,
  providerIds: account.providerIds,
});

/** `storage: null` keeps everything in memory only. */
export const createPreviewGateway = (
  storage: PreviewStorage | null = browserStorage(),
): AuthGateway => {
  const state = readState(storage);
  const listeners = new Set<(user: SessionUser | null) => void>();

  const accounts = () => [SEEDED_ACCOUNT, ...state.accounts];
  const findByEmail = (email: string) =>
    accounts().find(account => account.email === email.trim().toLowerCase());
  const findByUid = (uid: string | null) =>
    accounts().find(account => account.uid === uid);
  const currentUser = () => {
    const account = findByUid(state.currentUid);
    return account ? toSessionUser(account) : null;
  };

  const save = () => {
    try {
      storage?.setItem(PREVIEW_GATEWAY_MARKER, JSON.stringify(state));
    } catch {
      // Memory only.
    }
  };

  const setCurrent = (account: PreviewAccount | null) => {
    state.currentUid = account?.uid ?? null;
    save();
    const user = currentUser();
    listeners.forEach(listener => listener(user));
  };

  const signInAsSampleUser = async (): Promise<SSOSignInResult> => {
    setCurrent(SEEDED_ACCOUNT);
    return {
      user: toSessionUser(SEEDED_ACCOUNT),
      names: { ...SEEDED_ACCOUNT.profile },
    };
  };

  return {
    subscribeToAuthState: listener => {
      listeners.add(listener);
      listener(currentUser());
      return () => {
        listeners.delete(listener);
      };
    },
    getCurrentSessionUser: currentUser,

    watchProfile: (uid, onNext) => {
      onNext(findByUid(uid)?.profile ?? null);
      return () => undefined;
    },
    createProfileIfMissing: async uid =>
      hasCompleteNames(findByUid(uid)?.profile),
    getClaims: async () => NO_CLAIMS,

    signUpWithEmail: async (email, password, profile) => {
      if (findByEmail(email)) {
        throw new AppAuthError(AuthErrorCode.EmailAlreadyInUse);
      }
      const account: PreviewAccount = {
        uid: `preview-${state.accounts.length + 1}-${Date.now()}`,
        email: email.trim().toLowerCase(),
        password,
        providerIds: [PASSWORD_PROVIDER_ID],
        profile,
      };
      state.accounts.push(account);
      setCurrent(account);
      return toSessionUser(account);
    },
    signInWithEmail: async (email, password) => {
      const account = findByEmail(email);
      // Like Firebase with email enumeration protection: one code for both mistakes.
      if (!account || account.password !== password) {
        throw new AppAuthError(AuthErrorCode.InvalidCredential);
      }
      setCurrent(account);
      return toSessionUser(account);
    },
    // No email exists here; the answer is the same whether the account exists or not.
    sendPasswordReset: async () => undefined,

    signInWithGoogle: signInAsSampleUser,
    signInWithApple: signInAsSampleUser,

    signOut: async () => {
      setCurrent(null);
    },
  };
};
