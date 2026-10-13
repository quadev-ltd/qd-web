import * as authModule from './auth';
import * as claimsModule from './claims';
import * as flagsModule from './flags';
import { createFirebaseGateway } from './gateway';
import * as profileModule from './profile';

import { getReauthMethod } from '@/core/auth/reauth';
import { unavailableGateway } from '@/core/auth/unavailableGateway';

vi.mock('./auth', () => ({
  deleteAccount: vi.fn(),
  getCurrentSessionUser: vi.fn(),
  refreshUser: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  signUpWithEmail: vi.fn(),
  subscribeToAuthState: vi.fn(),
}));
vi.mock('./claims', () => ({ getClaims: vi.fn() }));
vi.mock('./flags', () => ({
  getFlagOverrides: vi.fn(),
  getRemoteFlags: vi.fn(),
}));
vi.mock('./profile', () => ({
  createProfileIfMissing: vi.fn(),
  saveProfile: vi.fn(),
  watchProfile: vi.fn(),
}));

describe('the Firebase gateway', () => {
  const gateway = createFirebaseGateway();

  it('has every function of the auth gateway', () => {
    expect(Object.keys(gateway).sort()).toEqual(
      Object.keys(unavailableGateway).sort(),
    );
  });

  it('is made of the module functions of this folder', () => {
    expect(gateway.subscribeToAuthState).toBe(authModule.subscribeToAuthState);
    expect(gateway.signUpWithEmail).toBe(authModule.signUpWithEmail);
    expect(gateway.signInWithGoogle).toBe(authModule.signInWithGoogle);
    expect(gateway.deleteAccount).toBe(authModule.deleteAccount);
    expect(gateway.refreshUser).toBe(authModule.refreshUser);
    expect(gateway.watchProfile).toBe(profileModule.watchProfile);
    expect(gateway.saveProfile).toBe(profileModule.saveProfile);
    expect(gateway.getClaims).toBe(claimsModule.getClaims);
    expect(gateway.getFlagOverrides).toBe(flagsModule.getFlagOverrides);
    expect(gateway.getRemoteFlags).toBe(flagsModule.getRemoteFlags);
  });

  it('chooses how to confirm a deletion with the rule every gateway shares', () => {
    expect(gateway.getReauthMethod).toBe(getReauthMethod);
  });
});
