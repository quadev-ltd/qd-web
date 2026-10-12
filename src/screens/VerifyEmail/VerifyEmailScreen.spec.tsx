// Mirrors qd-mobile src/screens/VerifyEmail/VerifyEmailScreen.spec.tsx, plus what is
// different on the web: the header, the states of the buttons and where the focus goes.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RESEND_COOLDOWN_SECONDS, waitLeftAfterSignUp } from './useVerifyEmail';
import { VerifyEmailScreen } from './VerifyEmailScreen';

import { type SessionUser } from '@/core/auth/types';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const unverifiedUser: SessionUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: false,
  displayName: null,
  providerIds: ['password'],
};
const verifiedUser: SessionUser = { ...unverifiedUser, emailVerified: true };

const session = {
  status: SessionStatus.NeedsEmailVerification,
  authResolved: true,
  user: unverifiedUser,
  profile: { firstName: 'Ada', lastName: 'Lovelace' },
  profileStatus: 'loaded' as const,
};

const authError = (code: string) =>
  Object.assign(new Error(`[${code}] message`), { code });

const renderScreen = (overrides: Partial<typeof session> = {}) => {
  const gateway = createMockGateway();
  gateway.refreshUser.mockResolvedValue(unverifiedUser);
  const utils = renderWithProviders(<VerifyEmailScreen />, {
    gateway,
    route: '/verify-email',
    session: { ...session, ...overrides },
  });
  return { gateway, ...utils };
};

const verifiedButton = () =>
  screen.getByRole('button', { name: 'emailVerification.verifiedCTA' });
const resendButton = () =>
  screen.getByRole('button', { name: /^emailVerification\.resend/ });

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('VerifyEmailScreen', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('welcomes the user by name and says where the email went', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'emailVerification.title brand.applicationName Ada!',
      }),
    ).toBeInTheDocument();
    // The email is in bold inside the sentence; the header repeats it.
    const email = screen
      .getAllByText('ada@example.com')
      .find(element => element.tagName === 'STRONG');
    expect(email?.parentElement).toHaveTextContent(
      'emailVerification.emailSentada@example.com',
    );
    expect(
      screen.getByText('emailVerification.emailVerificationInstructions'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('status-icon-mail')).toBeInTheDocument();
    expect(verifiedButton()).toBeEnabled();
    expect(resendButton()).toBeEnabled();
    expect(resendButton()).toHaveTextContent('emailVerification.resendCTA');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.title).toBe('emailVerification.documentTitle');
  });

  it('welcomes without a name while the profile is not there', () => {
    renderScreen({ profile: null as never });

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'emailVerification.title brand.applicationName!',
      }),
    ).toBeInTheDocument();
  });

  it('moves the session on when the email is verified', async () => {
    const { gateway, store } = renderScreen();
    gateway.refreshUser.mockResolvedValue(verifiedUser);
    gateway.getClaims.mockResolvedValue({ paid: true, admin: false });

    await userEvent.click(verifiedButton());

    await waitFor(() =>
      expect(store.getState().session.status).toBe(SessionStatus.Ready),
    );
    expect(store.getState().session.user).toEqual(verifiedUser);
    // The claims are read again: the new token carries `email_verified`.
    await waitFor(() =>
      expect(store.getState().session.claims).toEqual({
        paid: true,
        admin: false,
      }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when the email is not verified yet, and moves the focus to the message', async () => {
    const { store } = renderScreen();

    await userEvent.click(verifiedButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('emailVerification.notVerifiedYet');
    expect(alert).toHaveFocus();
    expect(store.getState().session.status).toBe(
      SessionStatus.NeedsEmailVerification,
    );
    expect(verifiedButton()).toBeEnabled();
    expect(resendButton()).toBeEnabled();
  });

  it('shows that it is checking: both buttons wait', async () => {
    const { gateway } = renderScreen();
    gateway.refreshUser.mockReturnValue(new Promise(() => undefined));

    await userEvent.click(verifiedButton());

    expect(verifiedButton()).toBeDisabled();
    expect(verifiedButton()).toHaveAttribute('aria-busy', 'true');
    expect(resendButton()).toBeDisabled();
    expect(screen.getByTestId('status-icon-busy')).toBeInTheDocument();
  });

  it('shows the error when the check fails', async () => {
    const { gateway } = renderScreen();
    gateway.refreshUser.mockRejectedValue(
      authError('auth/network-request-failed'),
    );

    await userEvent.click(verifiedButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.networkError',
    );
    expect(verifiedButton()).toBeEnabled();
  });

  it('does nothing when the session is already gone', async () => {
    const { gateway, store } = renderScreen();
    gateway.refreshUser.mockResolvedValue(null);

    await userEvent.click(verifiedButton());

    await waitFor(() => expect(verifiedButton()).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(store.getState().session.user).toEqual(unverifiedUser);
  });

  describe('when the tab becomes visible again', () => {
    it('checks without asking, and moves on if the email is verified', async () => {
      const { gateway, store } = renderScreen();
      gateway.refreshUser.mockResolvedValue(verifiedUser);

      setVisibility('visible');

      await waitFor(() =>
        expect(store.getState().session.status).toBe(SessionStatus.Ready),
      );
      expect(gateway.refreshUser).toHaveBeenCalledTimes(1);
    });

    it('says nothing if the email is still not verified, or if the check fails', async () => {
      const { gateway } = renderScreen();

      setVisibility('visible');
      await waitFor(() => expect(gateway.refreshUser).toHaveBeenCalledTimes(1));
      gateway.refreshUser.mockRejectedValue(
        authError('auth/network-request-failed'),
      );
      setVisibility('visible');
      await waitFor(() => expect(gateway.refreshUser).toHaveBeenCalledTimes(2));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(verifiedButton()).toBeEnabled();
      expect(screen.getByTestId('status-icon-mail')).toBeInTheDocument();
    });

    it('does not check when the tab is hidden', () => {
      const { gateway } = renderScreen();

      setVisibility('hidden');

      expect(gateway.refreshUser).not.toHaveBeenCalled();
    });

    it('stops checking once the screen is gone', () => {
      const { gateway, unmount } = renderScreen();
      unmount();

      setVisibility('visible');

      expect(gateway.refreshUser).not.toHaveBeenCalled();
    });
  });

  describe('resending the link', () => {
    it('sends the email, says so and makes the user wait before the next one', async () => {
      const { gateway } = renderScreen();

      await userEvent.click(resendButton());

      expect(gateway.sendVerificationEmail).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(resendButton()).toBeDisabled());
      expect(resendButton()).toHaveTextContent(
        'emailVerification.resendCooldown',
      );
      expect(screen.getByTestId('status-icon-check')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'emailVerification.emailSent',
      );
      expect(verifiedButton()).toBeEnabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows that the email is being sent: both buttons wait', async () => {
      const { gateway } = renderScreen();
      gateway.sendVerificationEmail.mockReturnValue(
        new Promise(() => undefined),
      );

      await userEvent.click(resendButton());

      expect(resendButton()).toBeDisabled();
      expect(resendButton()).toHaveAttribute('aria-busy', 'true');
      expect(verifiedButton()).toBeDisabled();
      expect(screen.getByTestId('status-icon-busy')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('lets the user send again after the wait', async () => {
      vi.useFakeTimers();
      const { gateway } = renderScreen();

      // With the timers stopped, userEvent and waitFor would wait for ever: a plain click,
      // then let the pending promises settle.
      fireEvent.click(resendButton());
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(resendButton()).toBeDisabled();

      await act(() =>
        vi.advanceTimersByTimeAsync((RESEND_COOLDOWN_SECONDS - 1) * 1000),
      );
      expect(resendButton()).toBeDisabled();

      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(resendButton()).toBeEnabled();
      expect(resendButton()).toHaveTextContent('emailVerification.resendCTA');

      fireEvent.click(resendButton());
      expect(gateway.sendVerificationEmail).toHaveBeenCalledTimes(2);
    });

    it('measures the wait against the clock, so a slowed-down tab does not wait longer', async () => {
      vi.useFakeTimers();
      renderScreen();

      fireEvent.click(resendButton());
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(resendButton()).toBeDisabled();

      // The browser ran no timer for a minute (a tab in the background): the next tick ends it.
      vi.setSystemTime(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      await act(() => vi.advanceTimersByTimeAsync(1000));

      expect(resendButton()).toBeEnabled();
    });

    it('starts with the wait running for an account that was just created', async () => {
      vi.useFakeTimers();
      const { gateway } = renderScreen({
        user: { ...unverifiedUser, createdAt: Date.now() - 10_000 },
      });

      // Signing up sent the first email 10 seconds ago: no second one yet, and no message.
      expect(resendButton()).toBeDisabled();
      expect(resendButton()).toHaveTextContent(
        'emailVerification.resendCooldown',
      );
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(verifiedButton()).toBeEnabled();
      fireEvent.click(resendButton());
      expect(gateway.sendVerificationEmail).not.toHaveBeenCalled();

      await act(() =>
        vi.advanceTimersByTimeAsync((RESEND_COOLDOWN_SECONDS - 11) * 1000),
      );
      expect(resendButton()).toBeDisabled();

      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(resendButton()).toBeEnabled();
      expect(resendButton()).toHaveTextContent('emailVerification.resendCTA');

      fireEvent.click(resendButton());
      expect(gateway.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('does not make the user of an older account wait', () => {
      renderScreen({
        user: {
          ...unverifiedUser,
          createdAt: Date.now() - RESEND_COOLDOWN_SECONDS * 1000,
        },
      });

      expect(resendButton()).toBeEnabled();
    });

    it('shows the throttling error from the backend and makes the user wait', async () => {
      const { gateway } = renderScreen();
      gateway.sendVerificationEmail.mockRejectedValue(
        authError('auth/too-many-requests'),
      );

      await userEvent.click(resendButton());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('error.tooManyRequestsError');
      expect(alert).toHaveFocus();
      expect(screen.getByTestId('status-icon-error')).toHaveClass(
        'text-danger',
      );
      expect(resendButton()).toBeDisabled();
      expect(resendButton()).toHaveTextContent(
        'emailVerification.resendCooldown',
      );
      expect(verifiedButton()).toBeEnabled();
    });

    it('shows another error and lets the user try again at once', async () => {
      const { gateway } = renderScreen();
      gateway.sendVerificationEmail.mockRejectedValue(
        authError('auth/network-request-failed'),
      );

      await userEvent.click(resendButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'error.networkError',
      );
      expect(resendButton()).toBeEnabled();
      expect(resendButton()).toHaveTextContent('emailVerification.resendCTA');
    });

    it('replaces an earlier message when the user tries again', async () => {
      const { gateway } = renderScreen();

      await userEvent.click(verifiedButton());
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'emailVerification.notVerifiedYet',
      );
      gateway.sendVerificationEmail.mockReturnValue(
        new Promise(() => undefined),
      );
      await userEvent.click(resendButton());

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('leaving', () => {
    it('"Use another account" signs out and leads to the sign-in screen', async () => {
      const { gateway, store } = renderScreen();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'emailVerification.changePathButton',
        }),
      );

      expect(gateway.signOut).toHaveBeenCalledTimes(1);
      expect(store.getState().exit.signedOutPath).toBe('/sign-in');
    });

    it('forgets that destination when signing out fails', async () => {
      const { gateway, store } = renderScreen();
      gateway.signOut.mockRejectedValue(
        authError('auth/network-request-failed'),
      );

      await userEvent.click(
        screen.getByRole('button', {
          name: 'emailVerification.changePathButton',
        }),
      );

      await waitFor(() => expect(mockLogger.logMessage).toHaveBeenCalled());
      expect(store.getState().exit.signedOutPath).toBeNull();
    });

    it('"Sign out" in the header signs out and keeps the usual destination', async () => {
      const { gateway, store } = renderScreen();

      await userEvent.click(
        screen.getByRole('button', { name: 'drawerMenu.signOut' }),
      );

      expect(gateway.signOut).toHaveBeenCalledTimes(1);
      expect(store.getState().exit.signedOutPath).toBeNull();
    });
  });
});

describe('waitLeftAfterSignUp', () => {
  const now = Date.UTC(2026, 9, 12, 14, 30, 0);

  it('counts the seconds left of the first minute of the account', () => {
    expect(waitLeftAfterSignUp(now, now)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(waitLeftAfterSignUp(now - 10_000, now)).toBe(50);
    expect(waitLeftAfterSignUp(now - 59_400, now)).toBe(1);
    expect(waitLeftAfterSignUp(now - 60_000, now)).toBe(0);
    expect(waitLeftAfterSignUp(now - 86_400_000, now)).toBe(0);
  });

  it('is no wait when the creation date is unknown', () => {
    expect(waitLeftAfterSignUp(undefined, now)).toBe(0);
  });

  it('is never longer than a full wait when the clock of the device is behind', () => {
    expect(waitLeftAfterSignUp(now + 300_000, now)).toBe(
      RESEND_COOLDOWN_SECONDS,
    );
  });
});
