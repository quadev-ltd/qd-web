import { AppAuthError, AuthErrorCode, NO_CURRENT_USER } from './errors';
import { type AuthGateway } from './gateway';
import { getReauthMethod } from './reauth';
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

import { type FlagKey, type FlagValues } from '@/core/flags/registry';

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
 *
 * The sample account has the interview tools and the CV tool switched on (the
 * `interviewAssistant` and `cvTool` flags), as an account an admin opened them for. An account created with the sign-up form has no flag
 * set, as on the real backend, and sees "Not available for your account yet".
 *
 * An account created with the sign-up form starts with an unverified email, as on the real
 * backend, but no email exists here. `window.qdPreview` (PreviewControls) stands for what
 * happens outside the site: `qdPreview.verifyEmail()` is "the user opened the link in the
 * email". The end-to-end tests use it, and so can anyone in the browser console.
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
  emailVerified: boolean;
  /** `null`: the account has no profile document (see PreviewControls.removeProfile). */
  profile: UserProfile | null;
  /** The feature flags set for this account alone (see PreviewControls.setFlag). */
  flags?: FlagValues;
}

/** What happens outside the site, for the signed-in preview account. Test and preview only. */
export interface PreviewControls {
  /** The user opened the link in the verification email. */
  verifyEmail(): void;
  /** The profile document is gone (a failed write at sign-up): the site asks for the names. */
  removeProfile(): void;
  /**
   * An admin set a feature flag for this account. As on the backend, the site reads the
   * flags once: reload the page to see the change.
   */
  setFlag(key: FlagKey, value: boolean): void;
}

/** The gateway, and the controls that `window.qdPreview` exposes. */
export type PreviewGateway = AuthGateway & { controls: PreviewControls };

declare global {
  interface Window {
    qdPreview?: PreviewControls;
  }
}

interface PreviewState {
  accounts: PreviewAccount[];
  currentUid: string | null;
  /** The flags of the sample account, when a test changed them (it is not in `accounts`). */
  sampleFlags?: FlagValues;
}

/** The part of the Web Storage API the gateway needs (sessionStorage, or a fake in tests). */
export type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>;

const SEEDED_ACCOUNT: PreviewAccount = {
  uid: 'preview-user',
  email: PREVIEW_USER.email,
  password: PREVIEW_USER.password,
  providerIds: [PASSWORD_PROVIDER_ID, GOOGLE_PROVIDER_ID, APPLE_PROVIDER_ID],
  emailVerified: true,
  profile: { ...PREVIEW_USER.profile },
  flags: { interviewAssistant: true, cvTool: true },
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
      ...(parsed.sampleFlags && typeof parsed.sampleFlags === 'object'
        ? { sampleFlags: parsed.sampleFlags }
        : {}),
    };
  } catch {
    return empty;
  }
};

const toSessionUser = (account: PreviewAccount): SessionUser => ({
  uid: account.uid,
  email: account.email,
  emailVerified: Boolean(account.emailVerified),
  displayName: null,
  providerIds: account.providerIds,
});

/** `storage: null` keeps everything in memory only. */
export const createPreviewGateway = (
  storage: PreviewStorage | null = browserStorage(),
): PreviewGateway => {
  const state = readState(storage);
  const listeners = new Set<(user: SessionUser | null) => void>();
  const profileListeners = new Map<
    string,
    Set<(profile: UserProfile | null) => void>
  >();
  // The sample account is the same for every tab; a changed profile lives in this tab only.
  const sampleAccount: PreviewAccount = {
    ...SEEDED_ACCOUNT,
    profile: { ...PREVIEW_USER.profile },
    flags: { ...SEEDED_ACCOUNT.flags, ...state.sampleFlags },
  };

  const accounts = () => [sampleAccount, ...state.accounts];
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
    setCurrent(sampleAccount);
    return {
      user: toSessionUser(sampleAccount),
      names: { ...PREVIEW_USER.profile },
    };
  };

  const notifyProfile = (account: PreviewAccount) => {
    profileListeners
      .get(account.uid)
      ?.forEach(listener => listener(account.profile));
  };

  const requireCurrentAccount = () => {
    const account = findByUid(state.currentUid);
    if (!account) {
      throw new AppAuthError(NO_CURRENT_USER);
    }
    return account;
  };

  const controls: PreviewControls = {
    verifyEmail: () => {
      requireCurrentAccount().emailVerified = true;
      save();
    },
    removeProfile: () => {
      const account = requireCurrentAccount();
      account.profile = null;
      save();
      notifyProfile(account);
    },
    setFlag: (key, value) => {
      const account = requireCurrentAccount();
      account.flags = { ...account.flags, [key]: value };
      if (account === sampleAccount) {
        state.sampleFlags = account.flags;
      }
      save();
    },
  };

  return {
    controls,
    subscribeToAuthState: listener => {
      listeners.add(listener);
      listener(currentUser());
      return () => {
        listeners.delete(listener);
      };
    },
    getCurrentSessionUser: currentUser,

    watchProfile: (uid, onNext) => {
      const watchers = profileListeners.get(uid) ?? new Set();
      profileListeners.set(uid, watchers);
      watchers.add(onNext);
      onNext(findByUid(uid)?.profile ?? null);
      return () => {
        watchers.delete(onNext);
      };
    },
    // Like the backend: an existing profile is left alone; a missing one is created from
    // the provider's names when both are there.
    createProfileIfMissing: async (uid, names) => {
      const account = findByUid(uid);
      if (!account) {
        return false;
      }
      if (!account.profile && names.firstName && names.lastName) {
        account.profile = {
          firstName: names.firstName,
          lastName: names.lastName,
        };
        save();
        notifyProfile(account);
      }
      return hasCompleteNames(account.profile);
    },
    saveProfile: async (uid, profile) => {
      const account = findByUid(uid);
      if (!account) {
        throw new AppAuthError(NO_CURRENT_USER);
      }
      account.profile = { ...profile };
      save();
      notifyProfile(account);
    },
    getClaims: async () => NO_CLAIMS,
    getFlagOverrides: async uid => ({ ...findByUid(uid)?.flags }),
    // Nothing is released to everyone here: a flag is on for the accounts it was set for.
    getRemoteFlags: async () => ({}),

    signUpWithEmail: async (email, password, profile) => {
      if (findByEmail(email)) {
        throw new AppAuthError(AuthErrorCode.EmailAlreadyInUse);
      }
      const account: PreviewAccount = {
        uid: `preview-${state.accounts.length + 1}-${Date.now()}`,
        email: email.trim().toLowerCase(),
        password,
        providerIds: [PASSWORD_PROVIDER_ID],
        // As on the backend: the email of a new account is not verified yet.
        emailVerified: false,
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
    // No email exists here and nothing is sent: `qdPreview.verifyEmail()` stands for opening
    // the link, and `refreshUser` then reports the verified user.
    sendVerificationEmail: async () => {
      requireCurrentAccount();
    },
    refreshUser: async () => currentUser(),
    // The answer is the same whether the account exists or not.
    sendPasswordReset: async () => undefined,

    signInWithGoogle: signInAsSampleUser,
    signInWithApple: signInAsSampleUser,

    signOut: async () => {
      setCurrent(null);
    },
    getReauthMethod,
    // Like the backend, without the Google window: a password account must give its
    // password (the backend asks for it only when the sign-in is old; the preview always
    // does, so the step can be seen), a wrong one is refused, and the account is gone
    // afterwards. The sample account is only signed out (it is built in).
    deleteAccount: async ({ password } = {}) => {
      const account = requireCurrentAccount();
      if (getReauthMethod(toSessionUser(account)) === 'password') {
        if (password === undefined) {
          throw new AppAuthError(AuthErrorCode.RequiresRecentLogin);
        }
        if (password !== account.password) {
          throw new AppAuthError(AuthErrorCode.InvalidCredential);
        }
      }
      state.accounts = state.accounts.filter(({ uid }) => uid !== account.uid);
      profileListeners.delete(account.uid);
      setCurrent(null);
    },
  };
};

/**
 * Puts the preview controls on `window.qdPreview`, for the browser console and the
 * end-to-end tests. Only the preview gateway has them, so they are never in a production build.
 */
export const exposePreviewControls = (gateway: PreviewGateway): AuthGateway => {
  window.qdPreview = gateway.controls;
  return gateway;
};
