import { selectAuthGateway } from './selectAuthGateway';
import { unavailableGateway } from './unavailableGateway';

describe('selectAuthGateway', () => {
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
  });
});
