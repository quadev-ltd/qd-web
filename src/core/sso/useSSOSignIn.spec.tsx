// Mirrors qd-mobile src/core/sso/useSSOSignIn.spec.tsx. The app asserts on the recorded
// actions of a mock store and on the toast; here it is the real store and `setErrorMessage`.
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { Provider } from 'react-redux';

import { useSSOSignIn } from './useSSOSignIn';

import { AuthGatewayProvider } from '@/core/auth/AuthGatewayProvider';
import { ACCOUNT_UNAVAILABLE, SIGN_IN_CANCELLED } from '@/core/auth/errors';
import {
  profileSetupFinished,
  profileSetupStarted,
  providerNamesReceived,
} from '@/core/state/slices/sessionSlice';
import { createStore } from '@/core/state/store';
import { createMockGateway } from '@/testUtil/mockGateway';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const result = {
  user: {
    uid: 'uid-1',
    email: null,
    emailVerified: true,
    displayName: null,
    providerIds: ['google.com'],
  },
  names: { firstName: 'Ada', lastName: 'L' },
};

const setup = (signIn: () => Promise<unknown>) => {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  const gateway = createMockGateway();
  const setIsLoading = vi.fn();
  const setErrorMessage = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <AuthGatewayProvider gateway={gateway}>{children}</AuthGatewayProvider>
    </Provider>
  );
  const { result: hook } = renderHook(
    () =>
      useSSOSignIn({
        provider: 'google',
        setIsLoading,
        setErrorMessage,
        signIn: signIn as never,
      }),
    { wrapper },
  );
  const actions = () => dispatch.mock.calls.map(([action]) => action);
  return { store, gateway, setIsLoading, setErrorMessage, hook, actions };
};

describe('useSSOSignIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the profile from the provider names while holding the session', async () => {
    const { gateway, setIsLoading, setErrorMessage, hook, actions, store } =
      setup(() => Promise.resolve(result));

    await act(() => hook.current.handleSignIn());

    expect(gateway.createProfileIfMissing).toHaveBeenCalledWith(
      'uid-1',
      result.names,
    );
    expect(actions()).toEqual([
      profileSetupStarted(),
      providerNamesReceived(result.names),
      profileSetupFinished(),
    ]);
    expect(store.getState().session.profileSetupPending).toBe(false);
    expect(setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    expect(setErrorMessage).toHaveBeenCalledTimes(1);
    expect(setErrorMessage).toHaveBeenCalledWith(undefined);
  });

  it('does nothing when the user cancels', async () => {
    const { gateway, setErrorMessage, hook } = setup(() =>
      Promise.resolve(null),
    );

    await act(() => hook.current.handleSignIn());

    expect(gateway.createProfileIfMissing).not.toHaveBeenCalled();
    expect(setErrorMessage).toHaveBeenCalledTimes(1);
  });

  it('does not report a cancellation that arrives as an error', async () => {
    const { setErrorMessage, hook } = setup(() =>
      Promise.reject({ code: SIGN_IN_CANCELLED }),
    );

    await act(() => hook.current.handleSignIn());

    expect(setErrorMessage).toHaveBeenCalledTimes(1);
    expect(mockLogger.logError).not.toHaveBeenCalled();
    expect(mockLogger.logMessage).not.toHaveBeenCalled();
  });

  it('shows the mapped error when the sign-in fails', async () => {
    const { setErrorMessage, setIsLoading, hook, actions } = setup(() =>
      Promise.reject({ code: 'auth/account-exists-with-different-credential' }),
    );

    await act(() => hook.current.handleSignIn());

    expect(setErrorMessage).toHaveBeenLastCalledWith(
      'error.accountExistsWithDifferentCredential',
    );
    expect(actions()).toContainEqual(profileSetupFinished());
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error(
        'googleSignIn failed: code=auth/account-exists-with-different-credential',
      ),
    );
  });

  it('says that sign-in is not available yet when the gateway is unavailable', async () => {
    const { setErrorMessage, hook } = setup(() =>
      Promise.reject({ code: ACCOUNT_UNAVAILABLE }),
    );

    await act(() => hook.current.handleSignIn());

    expect(setErrorMessage).toHaveBeenLastCalledWith(
      'error.accountUnavailable',
    );
    expect(mockLogger.logError).not.toHaveBeenCalled();
  });

  it('stays quiet when only the profile write fails (the session takes over)', async () => {
    const { gateway, setErrorMessage, hook } = setup(() =>
      Promise.resolve(result),
    );
    gateway.createProfileIfMissing.mockRejectedValueOnce({
      code: 'firestore/permission-denied',
    });

    await act(() => hook.current.handleSignIn());

    expect(setErrorMessage).toHaveBeenCalledTimes(1);
    expect(setErrorMessage).toHaveBeenCalledWith(undefined);
  });
});
