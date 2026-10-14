import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { Provider } from 'react-redux';

import {
  FlagsProvider,
  useFlag,
  useFlags,
  useFlagsReady,
} from './FlagsProvider';
import { DEFAULT_FLAGS } from './registry';

import { AuthGatewayProvider } from '@/core/auth/AuthGatewayProvider';
import { type SessionUser } from '@/core/auth/types';
import { authStateChanged } from '@/core/state/slices/sessionSlice';
import { createStore } from '@/core/state/store';
import { createMockGateway } from '@/testUtil/mockGateway';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const user = (uid: string): SessionUser => ({
  uid,
  email: `${uid}@example.com`,
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
});

const Flags = () => (
  <p>{`interviewAssistant=${String(useFlag('interviewAssistant'))} ready=${String(useFlagsReady())}`}</p>
);

/** The real provider, with a store a spec can sign users in and out of. */
const setUp = (signedIn?: SessionUser) => {
  const gateway = createMockGateway();
  const store = createStore();
  if (signedIn) {
    store.dispatch(authStateChanged(signedIn));
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <AuthGatewayProvider gateway={gateway}>
        <FlagsProvider>{children}</FlagsProvider>
      </AuthGatewayProvider>
    </Provider>
  );
  return { gateway, store, wrapper };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FlagsProvider', () => {
  it('uses the code defaults without a provider', () => {
    render(<Flags />);

    expect(
      screen.getByText('interviewAssistant=false ready=true'),
    ).toBeInTheDocument();
    expect(renderHook(() => useFlags()).result.current).toEqual(DEFAULT_FLAGS);
  });

  it('gives every flag its code default to a visitor, and reads nothing', () => {
    const { gateway, wrapper } = setUp();

    const { result } = renderHook(
      () => ({ flags: useFlags(), ready: useFlagsReady() }),
      { wrapper },
    );

    expect(result.current.flags).toEqual({
      smartInspection: false,
      interviewAssistant: false,
      aiDiagnostics: false,
    });
    expect(result.current.ready).toBe(true);
    expect(gateway.getFlagOverrides).not.toHaveBeenCalled();
  });

  it('reads the overrides of the signed-in user, and is not ready before', async () => {
    const { gateway, wrapper } = setUp(user('uid-1'));
    gateway.getFlagOverrides.mockResolvedValue({ interviewAssistant: true });

    render(<Flags />, { wrapper });

    // Off, and known to be unfinished: a page can wait instead of saying "not available".
    expect(
      screen.getByText('interviewAssistant=false ready=false'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('interviewAssistant=true ready=true'),
    ).toBeInTheDocument();
    expect(gateway.getFlagOverrides).toHaveBeenCalledTimes(1);
    expect(gateway.getFlagOverrides).toHaveBeenCalledWith('uid-1');
  });

  describe('with Remote Config', () => {
    it('reads what is set for everyone, once, next to the overrides', async () => {
      const { gateway, wrapper } = setUp(user('uid-1'));
      gateway.getRemoteFlags.mockResolvedValue({ interviewAssistant: true });

      render(<Flags />, { wrapper });

      expect(
        await screen.findByText('interviewAssistant=true ready=true'),
      ).toBeInTheDocument();
      expect(gateway.getRemoteFlags).toHaveBeenCalledTimes(1);
      expect(gateway.getFlagOverrides).toHaveBeenCalledTimes(1);
    });

    it('lets the user’s override win in both directions', async () => {
      const on = setUp(user('uid-1'));
      on.gateway.getRemoteFlags.mockResolvedValue({
        interviewAssistant: false,
      });
      on.gateway.getFlagOverrides.mockResolvedValue({
        interviewAssistant: true,
      });
      const first = render(<Flags />, { wrapper: on.wrapper });
      expect(
        await screen.findByText('interviewAssistant=true ready=true'),
      ).toBeInTheDocument();
      first.unmount();

      const off = setUp(user('uid-1'));
      off.gateway.getRemoteFlags.mockResolvedValue({
        interviewAssistant: true,
      });
      off.gateway.getFlagOverrides.mockResolvedValue({
        interviewAssistant: false,
      });
      render(<Flags />, { wrapper: off.wrapper });
      expect(
        await screen.findByText('interviewAssistant=false ready=true'),
      ).toBeInTheDocument();
    });

    it('is not ready until both have answered', async () => {
      const { gateway, wrapper } = setUp(user('uid-1'));
      let answer: (flags: object) => void = () => undefined;
      gateway.getRemoteFlags.mockReturnValue(
        new Promise(resolve => {
          answer = resolve;
        }),
      );
      render(<Flags />, { wrapper });

      await waitFor(() => expect(gateway.getFlagOverrides).toHaveBeenCalled());
      expect(
        screen.getByText('interviewAssistant=false ready=false'),
      ).toBeInTheDocument();

      answer({ interviewAssistant: true });

      expect(
        await screen.findByText('interviewAssistant=true ready=true'),
      ).toBeInTheDocument();
    });

    it('goes on with the overrides when Remote Config cannot be read, and logs it', async () => {
      const { gateway, wrapper } = setUp(user('uid-1'));
      gateway.getRemoteFlags.mockRejectedValue({
        code: 'remoteconfig/fetch-timeout',
      });
      gateway.getFlagOverrides.mockResolvedValue({ interviewAssistant: true });

      render(<Flags />, { wrapper });

      expect(
        await screen.findByText('interviewAssistant=true ready=true'),
      ).toBeInTheDocument();
      expect(mockLogger.logError).toHaveBeenCalledWith(
        new Error(
          'getRemoteFlags failed: code=remoteconfig/fetch-timeout uid=uid-1',
        ),
      );
    });

    it('goes on with Remote Config when the overrides cannot be read', async () => {
      const { gateway, wrapper } = setUp(user('uid-1'));
      gateway.getFlagOverrides.mockRejectedValue({ code: 'unavailable' });
      gateway.getRemoteFlags.mockResolvedValue({ interviewAssistant: true });

      render(<Flags />, { wrapper });

      expect(
        await screen.findByText('interviewAssistant=true ready=true'),
      ).toBeInTheDocument();
    });

    it('reads nothing for a visitor who is not signed in', () => {
      const { gateway, wrapper } = setUp();

      render(<Flags />, { wrapper });

      expect(gateway.getRemoteFlags).not.toHaveBeenCalled();
    });
  });

  it('lets an override turn a flag off, and leaves the others at their default', async () => {
    const { gateway, wrapper } = setUp(user('uid-1'));
    gateway.getFlagOverrides.mockResolvedValue({ interviewAssistant: false });

    const { result } = renderHook(
      () => ({ flags: useFlags(), ready: useFlagsReady() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.flags).toEqual(DEFAULT_FLAGS);
  });

  it('falls back to the defaults when the overrides cannot be read, and logs it without the address', async () => {
    const { gateway, wrapper } = setUp(user('uid-1'));
    gateway.getFlagOverrides.mockRejectedValue({ code: 'unavailable' });

    render(<Flags />, { wrapper });

    expect(
      await screen.findByText('interviewAssistant=false ready=true'),
    ).toBeInTheDocument();
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getFlagOverrides failed: code=unavailable uid=uid-1'),
    );
    expect(JSON.stringify(mockLogger.logError.mock.calls)).not.toContain(
      'example.com',
    );
  });

  it('forgets the overrides when the user signs out', async () => {
    const { gateway, store, wrapper } = setUp(user('uid-1'));
    gateway.getFlagOverrides.mockResolvedValue({ interviewAssistant: true });
    render(<Flags />, { wrapper });
    await screen.findByText('interviewAssistant=true ready=true');

    store.dispatch(authStateChanged(null));

    expect(
      await screen.findByText('interviewAssistant=false ready=true'),
    ).toBeInTheDocument();
  });

  it('never applies one user’s overrides to the next', async () => {
    const { gateway, store, wrapper } = setUp(user('uid-1'));
    let answerSecond: (overrides: object) => void = () => undefined;
    gateway.getFlagOverrides.mockImplementation(uid =>
      uid === 'uid-1'
        ? Promise.resolve({ interviewAssistant: true })
        : new Promise(resolve => {
            answerSecond = resolve;
          }),
    );
    render(<Flags />, { wrapper });
    await screen.findByText('interviewAssistant=true ready=true');

    store.dispatch(authStateChanged(user('uid-2')));

    // The second user's flags are being read: off and not ready, not the first user's.
    expect(
      await screen.findByText('interviewAssistant=false ready=false'),
    ).toBeInTheDocument();
    expect(gateway.getFlagOverrides).toHaveBeenLastCalledWith('uid-2');

    answerSecond({});

    expect(
      await screen.findByText('interviewAssistant=false ready=true'),
    ).toBeInTheDocument();
  });

  it('drops an answer that arrives after the user has gone', async () => {
    const { gateway, store, wrapper } = setUp(user('uid-1'));
    let answer: (overrides: object) => void = () => undefined;
    gateway.getFlagOverrides.mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      }),
    );
    render(<Flags />, { wrapper });

    store.dispatch(authStateChanged(null));
    answer({ interviewAssistant: true });

    expect(
      await screen.findByText('interviewAssistant=false ready=true'),
    ).toBeInTheDocument();
  });
});
