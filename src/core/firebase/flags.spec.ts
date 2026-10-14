import { doc, getDoc } from 'firebase/firestore/lite';

import { getFlagOverrides, getRemoteFlags } from './flags';
import * as remoteConfigModule from './remoteConfig';

vi.mock('./app', () => ({ db: vi.fn(() => ({ name: 'db' })) }));
vi.mock('./remoteConfig', () => ({
  getRemoteFlags: vi.fn(() => Promise.resolve({ interviewAssistant: true })),
}));
vi.mock('firebase/firestore/lite', () => ({
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  getDoc: vi.fn(),
}));

const snapshot = (data?: Record<string, unknown>) =>
  ({ exists: () => data !== undefined, data: () => data }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the flag overrides of a user', () => {
  it('reads featureFlags/{uid}', async () => {
    vi.mocked(getDoc).mockResolvedValue(snapshot({ interviewAssistant: true }));

    await expect(getFlagOverrides('uid-1')).resolves.toEqual({
      interviewAssistant: true,
    });
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'featureFlags', 'uid-1');
    expect(getDoc).toHaveBeenCalledWith({ path: 'featureFlags/uid-1' });
  });

  it('overrides nothing when the document does not exist, which is the usual case', async () => {
    vi.mocked(getDoc).mockResolvedValue(snapshot());

    await expect(getFlagOverrides('uid-1')).resolves.toEqual({});
  });

  it('keeps only the flags this version knows, as true or false', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      snapshot({
        interviewAssistant: false,
        smartInspection: 'yes',
        aFlagAddedLater: true,
        updatedAt: { seconds: 1 },
        updatedBy: 'scripts/set-flag.ts',
      }),
    );

    await expect(getFlagOverrides('uid-1')).resolves.toEqual({
      interviewAssistant: false,
    });
  });

  it('passes a failed read on', async () => {
    const denied = { code: 'permission-denied' };
    vi.mocked(getDoc).mockRejectedValue(denied);

    await expect(getFlagOverrides('uid-1')).rejects.toBe(denied);
  });
});

describe('the flags set for everyone', () => {
  it('come from the Remote Config file, loaded on demand', async () => {
    await expect(getRemoteFlags()).resolves.toEqual({
      interviewAssistant: true,
    });
    expect(remoteConfigModule.getRemoteFlags).toHaveBeenCalledTimes(1);
  });

  it('pass a failed read on', async () => {
    const failure = { code: 'remoteconfig/fetch-timeout' };
    vi.mocked(remoteConfigModule.getRemoteFlags).mockRejectedValueOnce(failure);

    await expect(getRemoteFlags()).rejects.toBe(failure);
  });
});
