import { type AuthGateway } from './gateway';
import { selectAuthGateway } from './selectAuthGateway';
import { unavailableGateway } from './unavailableGateway';

const firebaseGateway = vi.hoisted(() => ({ name: 'the Firebase gateway' }));
const createFirebaseGateway = vi.hoisted(() => vi.fn());

// The Firebase SDK is never loaded in this spec: the folder is replaced as a whole.
vi.mock('@/core/firebase/gateway', () => ({ createFirebaseGateway }));

describe('selectAuthGateway', () => {
  beforeEach(() => {
    createFirebaseGateway.mockReset();
    createFirebaseGateway.mockReturnValue(firebaseGateway);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gives the unavailable gateway at once by default (.env.test)', () => {
    expect(selectAuthGateway()).toBe(unavailableGateway);
  });

  it('gives the unavailable gateway when the variable is not set', () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', '');

    expect(selectAuthGateway()).toBe(unavailableGateway);
  });

  it('loads the preview gateway only when VITE_AUTH_GATEWAY is "preview"', async () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'preview');

    const selected = selectAuthGateway();

    expect(selected).toBeInstanceOf(Promise);
    const gateway = await selected;
    expect(gateway).not.toBe(unavailableGateway);
    await expect(
      gateway.signInWithEmail('preview@example.com', 'Preview123!'),
    ).resolves.toMatchObject({ email: 'preview@example.com' });
    await gateway.signOut();
    // The preview controls (the stand-in for the verification email) come with it.
    expect(window.qdPreview).toEqual({
      verifyEmail: expect.any(Function),
      removeProfile: expect.any(Function),
      setFlag: expect.any(Function),
    });
    delete window.qdPreview;
    expect(createFirebaseGateway).not.toHaveBeenCalled();
  });

  it('loads the Firebase gateway when it is asked for and the account screens are on', async () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'firebase');
    vi.stubEnv('VITE_ACCOUNT_ENABLED', 'true');

    const selected = selectAuthGateway();

    expect(selected).toBeInstanceOf(Promise);
    expect(await selected).toBe(firebaseGateway as unknown as AuthGateway);
    expect(createFirebaseGateway).toHaveBeenCalledTimes(1);
  });

  it.each(['false', ''])(
    'keeps Firebase out while the account screens are off (VITE_ACCOUNT_ENABLED="%s")',
    accountEnabled => {
      vi.stubEnv('VITE_AUTH_GATEWAY', 'firebase');
      vi.stubEnv('VITE_ACCOUNT_ENABLED', accountEnabled);

      expect(selectAuthGateway()).toBe(unavailableGateway);
      expect(createFirebaseGateway).not.toHaveBeenCalled();
    },
  );

  it('does not load Firebase for another gateway, even with the account screens on', () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'unavailable');
    vi.stubEnv('VITE_ACCOUNT_ENABLED', 'true');

    expect(selectAuthGateway()).toBe(unavailableGateway);
    expect(createFirebaseGateway).not.toHaveBeenCalled();
  });
});
