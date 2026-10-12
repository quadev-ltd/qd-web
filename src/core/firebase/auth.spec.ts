import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAdditionalUserInfo,
  getIdToken,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import {
  deleteAccount,
  getCurrentSessionUser,
  refreshUser,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  subscribeToAuthState,
  toSessionUser,
} from './auth';
import { createProfile } from './profile';

const authState = vi.hoisted(() => ({ currentUser: null as unknown }));
const log = vi.hoisted(() => ({ logError: vi.fn(), logMessage: vi.fn() }));

vi.mock('@/core/logger', () => ({ default: vi.fn(() => log) }));
vi.mock('./app', () => ({ auth: () => authState }));
vi.mock('./profile', () => ({ createProfile: vi.fn(() => Promise.resolve()) }));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    providerId = 'google.com';

    customParameters: Record<string, string> = {};

    setCustomParameters(parameters: Record<string, string>) {
      this.customParameters = parameters;
    }
  }
  return {
    GoogleAuthProvider,
    EmailAuthProvider: {
      credential: vi.fn((email: string, password: string) => ({
        email,
        password,
      })),
    },
    createUserWithEmailAndPassword: vi.fn(),
    deleteUser: vi.fn(() => Promise.resolve()),
    getAdditionalUserInfo: vi.fn(() => null),
    getIdToken: vi.fn(() => Promise.resolve('token')),
    onAuthStateChanged: vi.fn(),
    reauthenticateWithCredential: vi.fn(() => Promise.resolve()),
    reauthenticateWithPopup: vi.fn(() => Promise.resolve()),
    reload: vi.fn(() => Promise.resolve()),
    sendEmailVerification: vi.fn(() => Promise.resolve()),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(() => Promise.resolve()),
  };
});

const fakeUser = (providerIds: string[], overrides: object = {}) => ({
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: false,
  displayName: null,
  providerData: providerIds.map(providerId => ({ providerId })),
  ...overrides,
});

const withCode = (code: string) => Object.assign(new Error(code), { code });

const codeOf = (action: Promise<unknown>) =>
  action.then(
    () => undefined,
    (error: { code?: string }) => error.code,
  );

const profile = { firstName: 'Ada', lastName: 'Lovelace' };
// jsdom serves the tests from this address.
const continueUrl = { url: `${window.location.origin}/verify-email` };

beforeEach(() => {
  vi.clearAllMocks();
  authState.currentUser = null;
});

describe('toSessionUser', () => {
  it('keeps only plain fields', () => {
    expect(toSessionUser(fakeUser(['password']) as never)).toEqual({
      uid: 'uid-1',
      email: 'ada@example.com',
      emailVerified: false,
      displayName: null,
      providerIds: ['password'],
    });
  });
});

describe('the session', () => {
  it('reports the signed-in user and sign-out as plain values', () => {
    const listener = vi.fn();
    const stop = vi.fn();
    vi.mocked(onAuthStateChanged).mockReturnValue(stop);

    expect(subscribeToAuthState(listener)).toBe(stop);
    const onChange = vi.mocked(onAuthStateChanged).mock.calls[0][1] as (
      user: unknown,
    ) => void;
    onChange(fakeUser(['google.com']));
    onChange(null);

    expect(onAuthStateChanged).toHaveBeenCalledWith(
      authState,
      expect.any(Function),
    );
    expect(listener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ uid: 'uid-1', providerIds: ['google.com'] }),
    );
    expect(listener).toHaveBeenNthCalledWith(2, null);
  });

  it('gives the current user, or null', () => {
    expect(getCurrentSessionUser()).toBeNull();

    authState.currentUser = fakeUser(['password']);

    expect(getCurrentSessionUser()).toMatchObject({ uid: 'uid-1' });
  });
});

describe('signUpWithEmail', () => {
  it('creates the account, then the profile, then sends the verification email', async () => {
    const user = fakeUser(['password']);
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
      user,
    } as never);

    const result = await signUpWithEmail(
      'ada@example.com',
      'Passw0rd!',
      profile,
    );

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'ada@example.com',
      'Passw0rd!',
    );
    expect(createProfile).toHaveBeenCalledWith('uid-1', profile);
    expect(sendEmailVerification).toHaveBeenCalledWith(user, continueUrl);
    const [account] = vi.mocked(createUserWithEmailAndPassword).mock
      .invocationCallOrder;
    const [profileWrite] = vi.mocked(createProfile).mock.invocationCallOrder;
    const [email] = vi.mocked(sendEmailVerification).mock.invocationCallOrder;
    expect(account).toBeLessThan(profileWrite);
    expect(profileWrite).toBeLessThan(email);
    expect(result).toMatchObject({ uid: 'uid-1', emailVerified: false });
  });

  it('rejects, and writes nothing, when the account cannot be created', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValue(
      withCode('auth/email-already-in-use'),
    );

    expect(
      await codeOf(signUpWithEmail('ada@example.com', 'Passw0rd!', profile)),
    ).toBe('auth/email-already-in-use');
    expect(createProfile).not.toHaveBeenCalled();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it('still succeeds, and still sends the email, when the profile write fails', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
      user: fakeUser(['password']),
    } as never);
    vi.mocked(createProfile).mockRejectedValueOnce(
      withCode('permission-denied'),
    );

    await expect(
      signUpWithEmail('ada@example.com', 'Passw0rd!', profile),
    ).resolves.toMatchObject({ uid: 'uid-1' });
    expect(sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(log.logError.mock.calls[0][0].message).toBe(
      'createProfile failed: code=permission-denied uid=uid-1',
    );
  });

  it('still succeeds when the verification email cannot be sent', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
      user: fakeUser(['password']),
    } as never);
    vi.mocked(sendEmailVerification).mockRejectedValueOnce(
      withCode('auth/too-many-requests'),
    );

    await expect(
      signUpWithEmail('ada@example.com', 'Passw0rd!', profile),
    ).resolves.toMatchObject({ uid: 'uid-1' });
  });
});

describe('email and password', () => {
  it('signs in', async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: fakeUser(['password'], { emailVerified: true }),
    } as never);

    await expect(
      signInWithEmail('ada@example.com', 'Passw0rd!'),
    ).resolves.toMatchObject({ uid: 'uid-1', emailVerified: true });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      authState,
      'ada@example.com',
      'Passw0rd!',
    );
  });

  it('sends the verification email again, with the way back to the site', async () => {
    const user = fakeUser(['password']);
    authState.currentUser = user;

    await sendVerificationEmail();

    expect(sendEmailVerification).toHaveBeenCalledWith(user, continueUrl);
  });

  it('cannot send the verification email when nobody is signed in', async () => {
    expect(await codeOf(sendVerificationEmail())).toBe('app/no-current-user');
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it('sends the password reset email', async () => {
    await sendPasswordReset('ada@example.com');

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      authState,
      'ada@example.com',
    );
  });
});

describe('refreshUser', () => {
  it('reloads the user, renews the ID token and returns the updated user', async () => {
    const user = fakeUser(['password']);
    authState.currentUser = user;
    vi.mocked(reload).mockImplementationOnce(async () => {
      authState.currentUser = { ...user, emailVerified: true };
    });

    await expect(refreshUser()).resolves.toMatchObject({
      uid: 'uid-1',
      emailVerified: true,
    });
    expect(reload).toHaveBeenCalledWith(user);
    expect(getIdToken).toHaveBeenCalledWith(authState.currentUser, true);
  });

  it('rejects when nobody is signed in', async () => {
    expect(await codeOf(refreshUser())).toBe('app/no-current-user');
  });
});

describe('signInWithGoogle', () => {
  it('opens the Google window with the account chooser and returns the user and the names', async () => {
    const credential = {
      user: fakeUser(['google.com'], { displayName: 'Ada Lovelace' }),
    };
    vi.mocked(signInWithPopup).mockResolvedValue(credential as never);
    vi.mocked(getAdditionalUserInfo).mockReturnValueOnce({
      profile: { given_name: 'Ada', family_name: 'King' },
    } as never);

    await expect(signInWithGoogle()).resolves.toEqual({
      user: expect.objectContaining({ uid: 'uid-1' }),
      names: { firstName: 'Ada', lastName: 'King' },
    });
    const [auth, provider] = vi.mocked(signInWithPopup).mock.calls[0];
    expect(auth).toBe(authState);
    expect(provider).toMatchObject({
      providerId: 'google.com',
      customParameters: { prompt: 'select_account' },
    });
  });

  it('takes the names from the display name when Google shares no separate names', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({
      user: fakeUser(['google.com'], { displayName: ' Ada  King Lovelace ' }),
    } as never);

    await expect(signInWithGoogle()).resolves.toMatchObject({
      names: { firstName: 'Ada', lastName: 'King Lovelace' },
    });
  });

  it('returns only the names it has', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({
      user: fakeUser(['google.com'], { displayName: 'Ada' }),
    } as never);

    const result = await signInWithGoogle();

    expect(result?.names).toEqual({ firstName: 'Ada' });
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    'resolves null when the user closes the window (%s)',
    async code => {
      vi.mocked(signInWithPopup).mockRejectedValue(withCode(code));

      await expect(signInWithGoogle()).resolves.toBeNull();
    },
  );

  it.each([
    'auth/popup-blocked',
    'auth/account-exists-with-different-credential',
    'auth/network-request-failed',
  ])('passes other failures on (%s)', async code => {
    vi.mocked(signInWithPopup).mockRejectedValue(withCode(code));

    expect(await codeOf(signInWithGoogle())).toBe(code);
  });
});

describe('signInWithApple', () => {
  it('is not available on the web yet', async () => {
    expect(await codeOf(signInWithApple())).toBe('app/account-unavailable');
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('signs out of Firebase', async () => {
    await signOut();

    expect(firebaseSignOut).toHaveBeenCalledWith(authState);
  });
});

describe('deleteAccount', () => {
  it('rejects when nobody is signed in', async () => {
    expect(await codeOf(deleteAccount())).toBe('app/no-current-user');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('Google: confirms in the Google window first, with the same account preselected, then deletes', async () => {
    const user = fakeUser(['google.com', 'password']);
    authState.currentUser = user;

    await deleteAccount({ password: 'ignored' });

    const [reauthUser, provider] = vi.mocked(reauthenticateWithPopup).mock
      .calls[0];
    expect(reauthUser).toBe(user);
    expect(provider).toMatchObject({
      providerId: 'google.com',
      customParameters: {
        prompt: 'select_account',
        login_hint: 'ada@example.com',
      },
    });
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith(user);
    expect(
      vi.mocked(reauthenticateWithPopup).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(deleteUser).mock.invocationCallOrder[0]);
  });

  it('Google: rejects with the cancellation code and deletes nothing when the window is closed', async () => {
    authState.currentUser = fakeUser(['google.com']);
    vi.mocked(reauthenticateWithPopup).mockRejectedValueOnce(
      withCode('auth/popup-closed-by-user'),
    );

    expect(await codeOf(deleteAccount())).toBe('app/sign-in-cancelled');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('Google: passes on the error and deletes nothing when another account is chosen', async () => {
    authState.currentUser = fakeUser(['google.com']);
    vi.mocked(reauthenticateWithPopup).mockRejectedValueOnce(
      withCode('auth/user-mismatch'),
    );

    expect(await codeOf(deleteAccount())).toBe('auth/user-mismatch');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('password, with the password: checks it, then deletes', async () => {
    const user = fakeUser(['password']);
    authState.currentUser = user;

    await deleteAccount({ password: 'Passw0rd!' });

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
      'ada@example.com',
      'Passw0rd!',
    );
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(user, {
      email: 'ada@example.com',
      password: 'Passw0rd!',
    });
    expect(deleteUser).toHaveBeenCalledWith(user);
    expect(reauthenticateWithPopup).not.toHaveBeenCalled();
  });

  it('password, with a wrong password: deletes nothing', async () => {
    authState.currentUser = fakeUser(['password']);
    vi.mocked(reauthenticateWithCredential).mockRejectedValueOnce(
      withCode('auth/invalid-credential'),
    );

    expect(await codeOf(deleteAccount({ password: 'wrong' }))).toBe(
      'auth/invalid-credential',
    );
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('password, without the password: tries at once and passes "recent login" to the caller', async () => {
    const user = fakeUser(['password']);
    authState.currentUser = user;
    vi.mocked(deleteUser).mockRejectedValueOnce(
      withCode('auth/requires-recent-login'),
    );

    expect(await codeOf(deleteAccount())).toBe('auth/requires-recent-login');
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it('an Apple-only account: no confirmation is possible on the web, so it tries at once', async () => {
    const user = fakeUser(['apple.com']);
    authState.currentUser = user;

    await deleteAccount();

    expect(reauthenticateWithPopup).not.toHaveBeenCalled();
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith(user);
  });
});
