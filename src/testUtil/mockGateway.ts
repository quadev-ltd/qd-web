import { type Mocked } from 'vitest';

import { type AuthGateway } from '@/core/auth/gateway';
import { getReauthMethod } from '@/core/auth/reauth';
import { NO_CLAIMS } from '@/core/auth/types';

/**
 * An auth gateway made of mock functions, for specs: nobody is signed in and every action
 * resolves. A spec sets what it needs (`gateway.signInWithEmail.mockRejectedValue(...)`).
 */
export const createMockGateway = (): Mocked<AuthGateway> => ({
  subscribeToAuthState: vi.fn(listener => {
    listener(null);
    return vi.fn();
  }),
  getCurrentSessionUser: vi.fn(() => null),
  watchProfile: vi.fn(() => vi.fn()),
  createProfileIfMissing: vi.fn(() => Promise.resolve(true)),
  saveProfile: vi.fn(() => Promise.resolve()),
  getClaims: vi.fn(() => Promise.resolve(NO_CLAIMS)),
  getFlagOverrides: vi.fn(() => Promise.resolve({})),
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  refreshUser: vi.fn(() => Promise.resolve(null)),
  sendPasswordReset: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
  // The real rule by default (it is a pure function); a spec can still override it.
  getReauthMethod: vi.fn(getReauthMethod),
  deleteAccount: vi.fn(() => Promise.resolve()),
});

export default createMockGateway;
