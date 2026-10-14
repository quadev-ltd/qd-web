import { AuthErrorCode, NO_CURRENT_USER } from './errors';
import {
  createPreviewGateway,
  exposePreviewControls,
  PREVIEW_GATEWAY_MARKER,
  PREVIEW_USER,
  type PreviewStorage,
} from './previewGateway';

import { isPasswordValid } from '@/hooks/usePasswordValidation';

const memoryStorage = (): PreviewStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const codeOf = (action: Promise<unknown>) =>
  action.then(
    () => undefined,
    (error: { code?: string }) => error.code,
  );

const newProfile = { firstName: 'Grace', lastName: 'Hopper' };

describe('previewGateway', () => {
  it('starts signed out', () => {
    const gateway = createPreviewGateway(memoryStorage());
    const listener = vi.fn();

    gateway.subscribeToAuthState(listener);

    expect(listener).toHaveBeenCalledWith(null);
    expect(gateway.getCurrentSessionUser()).toBeNull();
  });

  it('has a sample user whose password follows the rules', () => {
    expect(isPasswordValid(PREVIEW_USER.password).isValid).toBe(true);
  });

  it('signs the sample user in: verified, with a complete profile', async () => {
    const gateway = createPreviewGateway(memoryStorage());
    const listener = vi.fn();
    gateway.subscribeToAuthState(listener);

    const user = await gateway.signInWithEmail(
      PREVIEW_USER.email,
      PREVIEW_USER.password,
    );

    expect(user).toMatchObject({
      email: 'preview@example.com',
      emailVerified: true,
    });
    expect(user.providerIds).toContain('password');
    expect(listener).toHaveBeenLastCalledWith(user);
    expect(gateway.getCurrentSessionUser()).toEqual(user);

    const onProfile = vi.fn();
    gateway.watchProfile(user.uid, onProfile, vi.fn());
    expect(onProfile).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    await expect(gateway.getClaims()).resolves.toEqual({
      paid: false,
      admin: false,
    });
  });

  it('rejects a wrong password and an unknown email with auth/invalid-credential', async () => {
    const gateway = createPreviewGateway(memoryStorage());

    expect(
      await codeOf(
        gateway.signInWithEmail(PREVIEW_USER.email, 'Wr0ngPassword!'),
      ),
    ).toBe(AuthErrorCode.InvalidCredential);
    expect(
      await codeOf(
        gateway.signInWithEmail('nobody@example.com', PREVIEW_USER.password),
      ),
    ).toBe(AuthErrorCode.InvalidCredential);
    expect(gateway.getCurrentSessionUser()).toBeNull();
  });

  it('signs up a new user in memory and signs them in', async () => {
    const gateway = createPreviewGateway(memoryStorage());
    const listener = vi.fn();
    gateway.subscribeToAuthState(listener);

    const user = await gateway.signUpWithEmail(
      'grace@example.com',
      'Passw0rd!e2e',
      { ...newProfile, dateOfBirth: '1906-12-09' },
    );

    // As on the backend: the email of a new account is not verified yet.
    expect(user).toMatchObject({
      email: 'grace@example.com',
      emailVerified: false,
      providerIds: ['password'],
    });
    expect(listener).toHaveBeenLastCalledWith(user);

    const onProfile = vi.fn();
    gateway.watchProfile(user.uid, onProfile, vi.fn());
    expect(onProfile).toHaveBeenCalledWith({
      ...newProfile,
      dateOfBirth: '1906-12-09',
    });

    await gateway.signOut();
    expect(listener).toHaveBeenLastCalledWith(null);
    await expect(
      gateway.signInWithEmail('grace@example.com', 'Passw0rd!e2e'),
    ).resolves.toMatchObject({ uid: user.uid });
  });

  it('rejects an email that already has an account with auth/email-already-in-use', async () => {
    const gateway = createPreviewGateway(memoryStorage());
    await gateway.signUpWithEmail(
      'grace@example.com',
      'Passw0rd!e2e',
      newProfile,
    );

    expect(
      await codeOf(
        gateway.signUpWithEmail(PREVIEW_USER.email, 'Passw0rd!e2e', newProfile),
      ),
    ).toBe(AuthErrorCode.EmailAlreadyInUse);
    expect(
      await codeOf(
        gateway.signUpWithEmail(
          'grace@example.com',
          'Passw0rd!e2e',
          newProfile,
        ),
      ),
    ).toBe(AuthErrorCode.EmailAlreadyInUse);
  });

  it.each(['signInWithGoogle', 'signInWithApple'] as const)(
    '%s signs in as the sample user and returns their names',
    async method => {
      const gateway = createPreviewGateway(memoryStorage());

      const result = await gateway[method]();

      expect(result?.user.email).toBe(PREVIEW_USER.email);
      expect(result?.names).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
      expect(gateway.getCurrentSessionUser()?.email).toBe(PREVIEW_USER.email);
      await expect(
        gateway.createProfileIfMissing(result?.user.uid ?? '', {}),
      ).resolves.toBe(true);
    },
  );

  it('answers a password reset the same way for any email', async () => {
    const gateway = createPreviewGateway(memoryStorage());

    await expect(
      gateway.sendPasswordReset(PREVIEW_USER.email),
    ).resolves.toBeUndefined();
    await expect(
      gateway.sendPasswordReset('nobody@example.com'),
    ).resolves.toBeUndefined();
  });

  it('stops calling a listener after it unsubscribes', async () => {
    const gateway = createPreviewGateway(memoryStorage());
    const listener = vi.fn();
    const stop = gateway.subscribeToAuthState(listener);
    listener.mockClear();

    stop();
    await gateway.signInWithEmail(PREVIEW_USER.email, PREVIEW_USER.password);

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the session and the new accounts across a reload (same storage)', async () => {
    const storage = memoryStorage();
    const first = createPreviewGateway(storage);
    const user = await first.signUpWithEmail(
      'grace@example.com',
      'Passw0rd!e2e',
      newProfile,
    );
    expect(storage.values.has(PREVIEW_GATEWAY_MARKER)).toBe(true);

    const afterReload = createPreviewGateway(storage);

    expect(afterReload.getCurrentSessionUser()).toEqual(user);
    await afterReload.signOut();
    expect(createPreviewGateway(storage).getCurrentSessionUser()).toBeNull();
    await expect(
      createPreviewGateway(storage).signInWithEmail(
        'grace@example.com',
        'Passw0rd!e2e',
      ),
    ).resolves.toMatchObject({ uid: user.uid });
  });

  it('works in memory when storage is missing, broken or holds something else', async () => {
    const broken: PreviewStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const garbage = memoryStorage();
    garbage.values.set(PREVIEW_GATEWAY_MARKER, 'not json');

    for (const storage of [null, broken, garbage]) {
      const gateway = createPreviewGateway(storage);
      expect(gateway.getCurrentSessionUser()).toBeNull();
      await expect(
        gateway.signInWithEmail(PREVIEW_USER.email, PREVIEW_USER.password),
      ).resolves.toMatchObject({ email: PREVIEW_USER.email });
    }
  });

  describe('verification, profile and deletion', () => {
    const signUp = async (gateway: ReturnType<typeof createPreviewGateway>) =>
      gateway.signUpWithEmail('grace@example.com', 'Passw0rd!e2e', newProfile);

    it('sends no email: a new account stays unverified until the link is "opened"', async () => {
      const storage = memoryStorage();
      const gateway = createPreviewGateway(storage);
      const user = await signUp(gateway);

      await expect(gateway.sendVerificationEmail()).resolves.toBeUndefined();
      await expect(gateway.refreshUser()).resolves.toEqual(user);
      expect(user.emailVerified).toBe(false);

      gateway.controls.verifyEmail();

      await expect(gateway.refreshUser()).resolves.toEqual({
        ...user,
        emailVerified: true,
      });
      // It survives a reload of the page.
      expect(createPreviewGateway(storage).getCurrentSessionUser()).toEqual({
        ...user,
        emailVerified: true,
      });
    });

    it('cannot verify when nobody is signed in', () => {
      const gateway = createPreviewGateway(memoryStorage());

      expect(() => gateway.controls.verifyEmail()).toThrow(NO_CURRENT_USER);
      expect(() => gateway.controls.removeProfile()).toThrow(NO_CURRENT_USER);
    });

    it('can lose the profile, and gets it back from the provider names or the form', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      const user = await signUp(gateway);
      const onProfile = vi.fn();
      gateway.watchProfile(user.uid, onProfile, vi.fn());

      gateway.controls.removeProfile();

      expect(onProfile).toHaveBeenLastCalledWith(null);
      // Incomplete names are not enough to create it.
      await expect(
        gateway.createProfileIfMissing(user.uid, { firstName: 'Grace' }),
      ).resolves.toBe(false);
      expect(onProfile).toHaveBeenLastCalledWith(null);

      await expect(
        gateway.createProfileIfMissing(user.uid, newProfile),
      ).resolves.toBe(true);
      expect(onProfile).toHaveBeenLastCalledWith(newProfile);
    });

    it('leaves an existing profile alone when the provider sends other names', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      const user = await signUp(gateway);

      await expect(
        gateway.createProfileIfMissing(user.uid, {
          firstName: 'Other',
          lastName: 'Name',
        }),
      ).resolves.toBe(true);

      const onProfile = vi.fn();
      gateway.watchProfile(user.uid, onProfile, vi.fn());
      expect(onProfile).toHaveBeenCalledWith(newProfile);
      await expect(
        gateway.createProfileIfMissing('nobody', newProfile),
      ).resolves.toBe(false);
    });

    it('has the interview tools on for the sample account, and no flag for a new one', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      const sample = await gateway.signInWithEmail(
        PREVIEW_USER.email,
        PREVIEW_USER.password,
      );
      const created = await gateway.signUpWithEmail(
        'grace@example.com',
        'Passw0rd!x',
        newProfile,
      );

      await expect(gateway.getFlagOverrides(sample.uid)).resolves.toEqual({
        interviewAssistant: true,
      });
      await expect(gateway.getFlagOverrides(created.uid)).resolves.toEqual({});
      await expect(gateway.getFlagOverrides('nobody')).resolves.toEqual({});
      // Nothing is released to everyone in the preview.
      await expect(gateway.getRemoteFlags()).resolves.toEqual({});
    });

    it('can set a flag for the signed-in account, and keeps it across a reload', async () => {
      const storage = memoryStorage();
      const gateway = createPreviewGateway(storage);
      const created = await gateway.signUpWithEmail(
        'grace@example.com',
        'Passw0rd!x',
        newProfile,
      );

      gateway.controls.setFlag('interviewAssistant', true);

      const reloaded = createPreviewGateway(storage);
      await expect(reloaded.getFlagOverrides(created.uid)).resolves.toEqual({
        interviewAssistant: true,
      });
    });

    it('can turn the interview tools off for the sample account, across a reload', async () => {
      const storage = memoryStorage();
      const gateway = createPreviewGateway(storage);
      const sample = await gateway.signInWithEmail(
        PREVIEW_USER.email,
        PREVIEW_USER.password,
      );

      gateway.controls.setFlag('interviewAssistant', false);

      await expect(gateway.getFlagOverrides(sample.uid)).resolves.toEqual({
        interviewAssistant: false,
      });
      await expect(
        createPreviewGateway(storage).getFlagOverrides(sample.uid),
      ).resolves.toEqual({ interviewAssistant: false });
      // Another tab still has the sample account as it comes.
      await expect(
        createPreviewGateway(memoryStorage()).getFlagOverrides(sample.uid),
      ).resolves.toEqual({ interviewAssistant: true });
    });

    it('cannot set a flag when nobody is signed in', () => {
      const gateway = createPreviewGateway(memoryStorage());

      expect(() =>
        gateway.controls.setFlag('interviewAssistant', true),
      ).toThrow();
    });

    it('puts the controls on window.qdPreview', async () => {
      const gateway = createPreviewGateway(memoryStorage());

      expect(exposePreviewControls(gateway)).toBe(gateway);
      expect(window.qdPreview).toBe(gateway.controls);

      delete window.qdPreview;
    });

    it('cannot resend the verification email when nobody is signed in', async () => {
      const gateway = createPreviewGateway(memoryStorage());

      expect(await codeOf(gateway.sendVerificationEmail())).toBe(
        NO_CURRENT_USER,
      );
      await expect(gateway.refreshUser()).resolves.toBeNull();
    });

    it('saves a profile, tells the watchers and keeps it across a reload', async () => {
      const storage = memoryStorage();
      const gateway = createPreviewGateway(storage);
      const user = await signUp(gateway);
      const onProfile = vi.fn();
      const stop = gateway.watchProfile(user.uid, onProfile, vi.fn());
      const changed = { firstName: 'Grace', lastName: 'Murray Hopper' };

      await gateway.saveProfile(user.uid, changed);

      expect(onProfile).toHaveBeenLastCalledWith(changed);
      const afterReload = vi.fn();
      createPreviewGateway(storage).watchProfile(
        user.uid,
        afterReload,
        vi.fn(),
      );
      expect(afterReload).toHaveBeenCalledWith(changed);

      stop();
      onProfile.mockClear();
      await gateway.saveProfile(user.uid, newProfile);
      expect(onProfile).not.toHaveBeenCalled();
    });

    it('changes the sample user for this gateway only', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      const { user } = (await gateway.signInWithGoogle())!;

      await gateway.saveProfile(user.uid, { firstName: 'A', lastName: 'B' });

      const other = vi.fn();
      createPreviewGateway(memoryStorage()).watchProfile(
        user.uid,
        other,
        vi.fn(),
      );
      expect(other).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
    });

    it('cannot save the profile of an unknown user', async () => {
      const gateway = createPreviewGateway(memoryStorage());

      expect(await codeOf(gateway.saveProfile('nobody', newProfile))).toBe(
        NO_CURRENT_USER,
      );
    });

    it('confirms a deletion like the backend: Google for the sample user, the password otherwise', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      const { user: sample } = (await gateway.signInWithGoogle())!;
      const user = await signUp(gateway);

      expect(gateway.getReauthMethod(sample)).toBe('google');
      expect(gateway.getReauthMethod(user)).toBe('password');
    });

    it('asks a password account for its password before deleting', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      await signUp(gateway);

      expect(await codeOf(gateway.deleteAccount())).toBe(
        AuthErrorCode.RequiresRecentLogin,
      );
      expect(gateway.getCurrentSessionUser()?.email).toBe('grace@example.com');
    });

    it('refuses a wrong password and keeps the account', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      await signUp(gateway);

      expect(await codeOf(gateway.deleteAccount({ password: 'wrong' }))).toBe(
        AuthErrorCode.InvalidCredential,
      );
      expect(gateway.getCurrentSessionUser()?.email).toBe('grace@example.com');
    });

    it('deletes the account: signed out, and the email can sign up again', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      const listener = vi.fn();
      gateway.subscribeToAuthState(listener);
      await signUp(gateway);

      await gateway.deleteAccount({ password: 'Passw0rd!e2e' });

      expect(listener).toHaveBeenLastCalledWith(null);
      expect(
        await codeOf(
          gateway.signInWithEmail('grace@example.com', 'Passw0rd!e2e'),
        ),
      ).toBe(AuthErrorCode.InvalidCredential);
      await expect(signUp(gateway)).resolves.toMatchObject({
        email: 'grace@example.com',
      });
    });

    it('only signs the built-in sample user out', async () => {
      const gateway = createPreviewGateway(memoryStorage());
      await gateway.signInWithGoogle();

      await gateway.deleteAccount();

      expect(gateway.getCurrentSessionUser()).toBeNull();
      await expect(
        gateway.signInWithEmail(PREVIEW_USER.email, PREVIEW_USER.password),
      ).resolves.toMatchObject({ email: PREVIEW_USER.email });
    });

    it('cannot delete when nobody is signed in', async () => {
      const gateway = createPreviewGateway(memoryStorage());

      expect(await codeOf(gateway.deleteAccount())).toBe(NO_CURRENT_USER);
    });
  });
});
