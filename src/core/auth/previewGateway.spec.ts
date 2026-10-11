import { AuthErrorCode } from './errors';
import {
  createPreviewGateway,
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

    expect(user).toMatchObject({
      email: 'grace@example.com',
      emailVerified: true,
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
});
