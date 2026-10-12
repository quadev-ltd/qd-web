import { getIdTokenResult } from 'firebase/auth';

import { getClaims } from './claims';

const authState = vi.hoisted(() => ({ currentUser: null as unknown }));

vi.mock('./app', () => ({ auth: () => authState }));
vi.mock('firebase/auth', () => ({ getIdTokenResult: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  authState.currentUser = null;
});

describe('getClaims', () => {
  it('gives no claims when nobody is signed in', async () => {
    await expect(getClaims()).resolves.toEqual({ paid: false, admin: false });
    expect(getIdTokenResult).not.toHaveBeenCalled();
  });

  it('reads paid and admin from the ID token', async () => {
    authState.currentUser = { uid: 'uid-1' };
    vi.mocked(getIdTokenResult).mockResolvedValue({
      claims: { paid: true, admin: 'yes' },
    } as never);

    await expect(getClaims()).resolves.toEqual({ paid: true, admin: false });
    expect(getIdTokenResult).toHaveBeenCalledWith({ uid: 'uid-1' }, false);
  });

  it('can force a new token', async () => {
    authState.currentUser = { uid: 'uid-1' };
    vi.mocked(getIdTokenResult).mockResolvedValue({ claims: {} } as never);

    await getClaims(true);

    expect(getIdTokenResult).toHaveBeenCalledWith({ uid: 'uid-1' }, true);
  });
});
