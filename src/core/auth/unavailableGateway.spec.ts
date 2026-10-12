import { ACCOUNT_UNAVAILABLE, AppAuthError } from './errors';
import { unavailableGateway } from './unavailableGateway';

describe('unavailableGateway', () => {
  it('has no way to confirm who the user is', () => {
    expect(
      unavailableGateway.getReauthMethod({
        uid: 'uid-1',
        email: 'ada@example.com',
        emailVerified: true,
        displayName: null,
        providerIds: ['password'],
      }),
    ).toBeNull();
  });

  it('reports at once that nobody is signed in', () => {
    const listener = vi.fn();

    const stop = unavailableGateway.subscribeToAuthState(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(null);
    expect(unavailableGateway.getCurrentSessionUser()).toBeNull();
    expect(() => stop()).not.toThrow();
  });

  it('has no claims and never reports a profile', async () => {
    const onNext = vi.fn();
    const onError = vi.fn();

    const stop = unavailableGateway.watchProfile('uid-1', onNext, onError);

    expect(onNext).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
    await expect(unavailableGateway.getClaims()).resolves.toEqual({
      paid: false,
      admin: false,
    });
  });

  it.each([
    ['signInWithEmail', () => unavailableGateway.signInWithEmail('a@b.c', 'x')],
    [
      'signUpWithEmail',
      () =>
        unavailableGateway.signUpWithEmail('a@b.c', 'x', {
          firstName: 'Ada',
          lastName: 'L',
        }),
    ],
    ['signInWithGoogle', () => unavailableGateway.signInWithGoogle()],
    ['signInWithApple', () => unavailableGateway.signInWithApple()],
    ['sendPasswordReset', () => unavailableGateway.sendPasswordReset('a@b.c')],
    [
      'createProfileIfMissing',
      () => unavailableGateway.createProfileIfMissing('uid-1', {}),
    ],
    ['signOut', () => unavailableGateway.signOut()],
    ['sendVerificationEmail', () => unavailableGateway.sendVerificationEmail()],
    ['refreshUser', () => unavailableGateway.refreshUser()],
    [
      'saveProfile',
      () =>
        unavailableGateway.saveProfile('uid-1', {
          firstName: 'Ada',
          lastName: 'L',
        }),
    ],
    ['deleteAccount', () => unavailableGateway.deleteAccount()],
  ])('rejects %s with the "not available yet" error', async (_name, action) => {
    const error = await action().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AppAuthError);
    expect((error as AppAuthError).code).toBe(ACCOUNT_UNAVAILABLE);
  });
});
