import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from 'firebase/remote-config';

import {
  getRemoteFlags,
  REMOTE_FLAGS_MAX_AGE_MS,
  REMOTE_FLAGS_TIMEOUT_MS,
} from './remoteConfig';

const testEnv = vi.hoisted(() => ({ USE_FIREBASE_EMULATORS: false }));
const remoteConfig = vi.hoisted(() => ({
  settings: { minimumFetchIntervalMillis: 0, fetchTimeoutMillis: 0 },
  defaultConfig: {} as Record<string, unknown>,
}));

vi.mock('@/core/env', () => ({ env: testEnv }));
vi.mock('./app', () => ({ app: vi.fn(() => ({ name: 'app' })) }));
vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: vi.fn(() => remoteConfig),
  fetchAndActivate: vi.fn(() => Promise.resolve(true)),
  getValue: vi.fn(),
}));

/** What the template holds: a flag it does not mention answers with its default. */
const template = (values: Record<string, boolean>) => {
  vi.mocked(getValue).mockImplementation((_config, key) => {
    const remote = Object.hasOwn(values, key);
    return {
      getSource: () => (remote ? 'remote' : 'default'),
      asBoolean: () => (remote ? values[key] : false),
    } as never;
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  testEnv.USE_FIREBASE_EMULATORS = false;
  template({});
});

describe('the flags from Remote Config', () => {
  it('fetches the template of the app, with the code defaults behind it', async () => {
    await getRemoteFlags();

    expect(getRemoteConfig).toHaveBeenCalledWith({ name: 'app' });
    expect(fetchAndActivate).toHaveBeenCalledWith(remoteConfig);
    expect(remoteConfig.defaultConfig).toEqual({
      smartInspection: false,
      interviewAssistant: false,
      cvTool: false,
      textPractice: false,
      aiDiagnostics: false,
    });
  });

  it('trusts a fetched template for an hour, and does not wait long for a slow network', async () => {
    await getRemoteFlags();

    expect(REMOTE_FLAGS_MAX_AGE_MS).toBe(60 * 60 * 1000);
    expect(remoteConfig.settings).toEqual({
      minimumFetchIntervalMillis: REMOTE_FLAGS_MAX_AGE_MS,
      fetchTimeoutMillis: REMOTE_FLAGS_TIMEOUT_MS,
    });
    expect(REMOTE_FLAGS_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it('gives the flags the template sets, on or off', async () => {
    template({ interviewAssistant: true, smartInspection: false });

    await expect(getRemoteFlags()).resolves.toEqual({
      interviewAssistant: true,
      smartInspection: false,
    });
  });

  it('leaves out a flag the template does not mention, so the code default decides', async () => {
    template({ interviewAssistant: true });

    const flags = await getRemoteFlags();

    expect(flags).toEqual({ interviewAssistant: true });
    expect(flags).not.toHaveProperty('aiDiagnostics');
  });

  it('only asks for the flags of the registry', async () => {
    await getRemoteFlags();

    expect(
      vi
        .mocked(getValue)
        .mock.calls.map(([, key]) => key)
        .sort(),
    ).toEqual([
      'aiDiagnostics',
      'cvTool',
      'interviewAssistant',
      'smartInspection',
      'textPractice',
    ]);
  });

  it('passes a failed fetch on', async () => {
    const failure = { code: 'remoteconfig/fetch-timeout' };
    vi.mocked(fetchAndActivate).mockRejectedValueOnce(failure);

    await expect(getRemoteFlags()).rejects.toBe(failure);
  });

  it('sets nothing against the local emulators, which have no Remote Config', async () => {
    testEnv.USE_FIREBASE_EMULATORS = true;

    await expect(getRemoteFlags()).resolves.toEqual({});
    expect(getRemoteConfig).not.toHaveBeenCalled();
    expect(fetchAndActivate).not.toHaveBeenCalled();
  });
});
