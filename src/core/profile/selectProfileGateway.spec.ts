import { ProfileErrorCode } from './errors';
import { type ProfileGateway } from './gateway';
import {
  resetProfileGatewayForTests,
  selectProfileGateway,
} from './selectProfileGateway';
import { unavailableProfileGateway } from './unavailableProfileGateway';

const firebaseGateway = vi.hoisted(() => ({ name: 'the Firebase gateway' }));
const createFirebaseProfileGateway = vi.hoisted(() => vi.fn());

// The Firebase SDK is never loaded in this spec: the folder is replaced as a whole.
vi.mock('@/core/firebase/profileGateway', () => ({
  createFirebaseProfileGateway,
}));

describe('selectProfileGateway', () => {
  beforeEach(() => {
    resetProfileGatewayForTests();
    createFirebaseProfileGateway.mockReset();
    createFirebaseProfileGateway.mockReturnValue(firebaseGateway);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.qdPreviewProfile;
  });

  it('gives the unavailable gateway at once by default (.env.test)', () => {
    expect(selectProfileGateway()).toBe(unavailableProfileGateway);
  });

  it('loads the preview gateway only when VITE_AUTH_GATEWAY is "preview"', async () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'preview');

    const selected = selectProfileGateway();

    expect(selected).toBeInstanceOf(Promise);
    const gateway = await selected;
    expect(gateway).not.toBe(unavailableProfileGateway);
    await expect(gateway.getResources('preview-user')).resolves.toEqual([]);
    // Its controls (what a test cannot wait for or cause) come with it.
    expect(window.qdPreviewProfile).toEqual({
      seed: expect.any(Function),
      failNext: expect.any(Function),
      stallNext: expect.any(Function),
      setExtractionsToday: expect.any(Function),
      seedApplications: expect.any(Function),
      failNextBrief: expect.any(Function),
      failNextJob: expect.any(Function),
      setBriefsToday: expect.any(Function),
      nextReread: expect.any(Function),
      failNextCv: expect.any(Function),
      setCvVersionsToday: expect.any(Function),
    });
    expect(createFirebaseProfileGateway).not.toHaveBeenCalled();
  });

  it('loads the Firebase gateway when it is asked for and the account screens are on', async () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'firebase');
    vi.stubEnv('VITE_ACCOUNT_ENABLED', 'true');

    const selected = selectProfileGateway();

    expect(selected).toBeInstanceOf(Promise);
    expect(await selected).toBe(firebaseGateway as unknown as ProfileGateway);
    expect(createFirebaseProfileGateway).toHaveBeenCalledTimes(1);
  });

  it.each(['false', ''])(
    'keeps Firebase out while the account screens are off (VITE_ACCOUNT_ENABLED="%s")',
    async accountEnabled => {
      vi.stubEnv('VITE_AUTH_GATEWAY', 'firebase');
      vi.stubEnv('VITE_ACCOUNT_ENABLED', accountEnabled);

      const gateway = selectProfileGateway() as ProfileGateway;

      expect(gateway).toBe(unavailableProfileGateway);
      await expect(gateway.getResources('uid-1')).rejects.toMatchObject({
        code: ProfileErrorCode.Unavailable,
      });
      expect(createFirebaseProfileGateway).not.toHaveBeenCalled();
    },
  );

  it('gives the same gateway every time: the profile’s routes and the home must share it', async () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'preview');

    const first = selectProfileGateway();
    const second = selectProfileGateway();

    expect(second).toBe(first);
    expect(await second).toBe(await first);
  });

  it('creates the Firebase gateway once, however often it is asked for', async () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'firebase');
    vi.stubEnv('VITE_ACCOUNT_ENABLED', 'true');

    await selectProfileGateway();
    await selectProfileGateway();

    expect(createFirebaseProfileGateway).toHaveBeenCalledTimes(1);
  });

  it('does not load Firebase for another gateway, even with the account screens on', () => {
    vi.stubEnv('VITE_AUTH_GATEWAY', 'unavailable');
    vi.stubEnv('VITE_ACCOUNT_ENABLED', 'true');

    expect(selectProfileGateway()).toBe(unavailableProfileGateway);
    expect(createFirebaseProfileGateway).not.toHaveBeenCalled();
  });
});
