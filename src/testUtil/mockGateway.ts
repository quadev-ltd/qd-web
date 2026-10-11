import { type Mocked } from 'vitest';

import { type AuthGateway } from '@/core/auth/gateway';
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
  getClaims: vi.fn(() => Promise.resolve(NO_CLAIMS)),
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  sendPasswordReset: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
});

export default createMockGateway;
