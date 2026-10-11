// Mirrors qd-mobile src/core/session/SessionProvider.spec.tsx; the Firebase service functions
// that the app mocks are the mock auth gateway here.
import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { SessionProvider } from './SessionProvider';

import { AuthGatewayProvider } from '@/core/auth/AuthGatewayProvider';
import { type SessionUser, type UserProfile } from '@/core/auth/types';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createStore } from '@/core/state/store';
import { createMockGateway } from '@/testUtil/mockGateway';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const user: SessionUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
};

describe('SessionProvider', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let emitUser: (value: SessionUser | null) => void;
  let emitProfile: (value: UserProfile | null) => void;
  let emitProfileError: (error: unknown) => void;
  const stopAuth = vi.fn();
  const stopProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = createMockGateway();
    gateway.subscribeToAuthState.mockImplementation(listener => {
      emitUser = listener;
      return stopAuth;
    });
    gateway.watchProfile.mockImplementation((_uid, onNext, onError) => {
      emitProfile = onNext;
      emitProfileError = onError;
      return stopProfile;
    });
    gateway.getClaims.mockResolvedValue({ paid: true, admin: false });
  });

  const renderProvider = () => {
    const store = createStore();
    const utils = render(
      <Provider store={store}>
        <AuthGatewayProvider gateway={gateway}>
          <SessionProvider>
            <p>child</p>
          </SessionProvider>
        </AuthGatewayProvider>
      </Provider>,
    );
    return { store, ...utils };
  };

  it('follows auth, profile and claims, and cleans up', async () => {
    const { store, unmount } = renderProvider();
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(store.getState().session.status).toBe(SessionStatus.Initializing);

    await act(async () => emitUser(user));
    expect(gateway.watchProfile).toHaveBeenCalledWith(
      'uid-1',
      expect.any(Function),
      expect.any(Function),
    );
    expect(store.getState().session.claims.paid).toBe(true);

    await act(async () => emitProfile({ firstName: 'Ada', lastName: 'L' }));
    expect(store.getState().session.status).toBe(SessionStatus.Ready);

    // Token refresh for the same user: no second profile listener.
    await act(async () => emitUser({ ...user }));
    expect(gateway.watchProfile).toHaveBeenCalledTimes(1);

    await act(async () => emitUser(null));
    expect(stopProfile).toHaveBeenCalled();
    expect(store.getState().session.status).toBe(SessionStatus.SignedOut);

    unmount();
    expect(stopAuth).toHaveBeenCalled();
  });

  it('ignores a profile listener error once the user has signed out', async () => {
    const { store } = renderProvider();
    await act(async () => emitUser(user));
    gateway.getCurrentSessionUser.mockReturnValue(null);
    await act(async () =>
      emitProfileError({ code: 'firestore/permission-denied' }),
    );
    expect(store.getState().session.profileStatus).toBe('loading');

    gateway.getCurrentSessionUser.mockReturnValue(user);
    await act(async () =>
      emitProfileError({ code: 'firestore/permission-denied' }),
    );
    expect(store.getState().session.status).toBe(SessionStatus.NeedsProfile);
  });

  it('leaves the loading state when the gateway cannot be reached', () => {
    gateway.subscribeToAuthState.mockImplementation(() => {
      throw new Error('gateway missing');
    });
    const { store } = renderProvider();
    expect(store.getState().session.status).toBe(SessionStatus.SignedOut);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('subscribeToAuthState failed: code=unknown'),
    );
  });

  it('logs a claims failure with the code and the uid only', async () => {
    gateway.getClaims.mockRejectedValue({ code: 'auth/internal-error' });
    renderProvider();

    await act(async () => emitUser(user));

    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getClaims failed: code=auth/internal-error uid=uid-1'),
    );
  });

  it('is signed out at once with the default (unavailable) gateway', () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <SessionProvider>
          <p>child</p>
        </SessionProvider>
      </Provider>,
    );

    expect(store.getState().session.status).toBe(SessionStatus.SignedOut);
  });
});
