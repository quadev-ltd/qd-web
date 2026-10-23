// Mirrors qd-mobile src/screens/DeleteAccount/DeleteAccountScreen.spec.tsx, plus what is
// different on the web: Cancel, the card that stays in place while the account is being
// deleted, the Google window, and the account that cannot be confirmed here.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeleteAccountScreen } from './DeleteAccountScreen';

import { AppAuthError, SIGN_IN_CANCELLED } from '@/core/auth/errors';
import { type SessionUser } from '@/core/auth/types';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const userWith = (...providerIds: string[]): SessionUser => ({
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: null,
  providerIds,
});
const passwordUser = userWith('password');
const googleUser = userWith('google.com');
const appleUser = userWith('apple.com');

const authError = (code: string) =>
  Object.assign(new Error(`[${code}] message`), { code });

const renderScreen = (user: SessionUser = passwordUser) => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(<DeleteAccountScreen />, {
    gateway,
    route: '/account/delete',
    session: {
      status: SessionStatus.Ready,
      authResolved: true,
      user,
      profile: { firstName: 'Ada', lastName: 'Lovelace' },
      profileStatus: 'loaded',
    },
  });
  return { gateway, ...utils };
};

const deleteButton = () =>
  screen.getByRole('button', { name: 'deleteAccount.deleteButton' });
const passwordField = () =>
  screen.getByLabelText('deleteAccount.passwordLabel');
const status = () => screen.getByRole('status');

describe('DeleteAccountScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks whether the user is sure, and offers the way out', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'deleteAccount.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('deleteAccount.description')).toBeInTheDocument();
    expect(screen.getByTestId('status-icon-trash')).toHaveClass('text-danger');
    expect(deleteButton()).toBeEnabled();
    expect(deleteButton()).toHaveAttribute('type', 'submit');
    expect(
      screen.getByRole('link', { name: 'deleteAccount.cancelButton' }),
    ).toHaveAttribute('href', '/account');
    expect(
      screen.queryByLabelText('deleteAccount.passwordLabel'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(status()).toBeEmptyDOMElement();
    expect(document.title).toBe('deleteAccount.documentTitle');
  });

  it('is framed like the signed-in pages', () => {
    renderScreen();

    expect(
      screen.getByRole('navigation', {
        name: 'header.mainNavAccessibilityLabel',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'header.accountMenuAccessibilityLabel',
      }),
    ).toHaveTextContent('Ada');
  });

  describe('an account with a password', () => {
    it('deletes the account and notes it for the public home', async () => {
      const { gateway, store } = renderScreen();

      await userEvent.click(deleteButton());

      expect(gateway.deleteAccount).toHaveBeenCalledWith({});
      await waitFor(() =>
        expect(store.getState().exit.accountDeleted).toBe(true),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // The app replaces the screen with a spinner; here the card stays, disabled.
    it('keeps the card in place, disabled, while the account is being deleted', async () => {
      const { gateway } = renderScreen();
      gateway.deleteAccount.mockReturnValue(new Promise(() => undefined));

      await userEvent.click(deleteButton());

      expect(deleteButton()).toBeDisabled();
      expect(deleteButton()).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(status()).toHaveTextContent('deleteAccount.deleting');
      expect(status()).not.toHaveTextContent(
        'deleteAccount.googleWindowNotice',
      );
      // Cancel cannot be followed any more.
      expect(
        screen.queryByRole('link', { name: 'deleteAccount.cancelButton' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'deleteAccount.cancelButton' }),
      ).toBeDisabled();
    });

    it('asks for the password after requires-recent-login, then deletes with it', async () => {
      const { gateway, store } = renderScreen();
      gateway.deleteAccount.mockRejectedValueOnce(
        authError('auth/requires-recent-login'),
      );

      await userEvent.click(deleteButton());

      expect(
        await screen.findByText('deleteAccount.reauthDescription'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('deleteAccount.description'),
      ).not.toBeInTheDocument();
      // No error: the question simply needs one more answer.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(mockLogger.logMessage).not.toHaveBeenCalled();
      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(passwordField()).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
      await waitFor(() => expect(passwordField()).toHaveFocus());
      expect(deleteButton()).toBeDisabled();
      expect(
        screen.getByRole('link', { name: 'deleteAccount.cancelButton' }),
      ).toHaveAttribute('href', '/account');

      await userEvent.type(passwordField(), 'Passw0rd!e2e');
      expect(deleteButton()).toBeEnabled();
      await userEvent.click(deleteButton());

      expect(gateway.deleteAccount).toHaveBeenLastCalledWith({
        password: 'Passw0rd!e2e',
      });
      await waitFor(() =>
        expect(store.getState().exit.accountDeleted).toBe(true),
      );
    });

    const openPasswordStep = async () => {
      const utils = renderScreen();
      utils.gateway.deleteAccount.mockRejectedValueOnce(
        authError('auth/requires-recent-login'),
      );
      await userEvent.click(deleteButton());
      await screen.findByText('deleteAccount.reauthDescription');
      return utils;
    };

    it('sends the form with Enter in the password field', async () => {
      const { gateway } = await openPasswordStep();

      await userEvent.type(passwordField(), 'Passw0rd!e2e{Enter}');

      expect(gateway.deleteAccount).toHaveBeenLastCalledWith({
        password: 'Passw0rd!e2e',
      });
    });

    it('can show and hide the password', async () => {
      await openPasswordStep();
      await userEvent.type(passwordField(), 'Passw0rd!e2e');

      await userEvent.click(
        screen.getByRole('button', { name: 'password.showAccessibilityLabel' }),
      );
      expect(passwordField()).toHaveAttribute('type', 'text');

      await userEvent.click(
        screen.getByRole('button', { name: 'password.hideAccessibilityLabel' }),
      );
      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(passwordField()).toHaveValue('Passw0rd!e2e');
    });

    it('shows "invalid password" when the password is wrong, ready to be typed again', async () => {
      const { gateway, store } = await openPasswordStep();
      gateway.deleteAccount.mockRejectedValueOnce(
        authError('auth/invalid-credential'),
      );

      await userEvent.type(passwordField(), 'wrong');
      await userEvent.click(deleteButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'fieldError.invalidEmailOrPasswordError',
      );
      await waitFor(() => expect(passwordField()).toHaveFocus());
      expect(passwordField()).toBeEnabled();
      expect(passwordField()).toHaveValue('wrong');
      expect(deleteButton()).toBeEnabled();
      expect(store.getState().exit.accountDeleted).toBe(false);

      // The message goes away with the next try.
      gateway.deleteAccount.mockReturnValue(new Promise(() => undefined));
      await userEvent.click(deleteButton());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(passwordField()).toBeDisabled();
    });

    it('says to sign in again when the password was right but the sign-in is still too old', async () => {
      const { gateway } = await openPasswordStep();
      gateway.deleteAccount.mockRejectedValueOnce(
        authError('auth/requires-recent-login'),
      );

      await userEvent.type(passwordField(), 'Passw0rd!e2e');
      await userEvent.click(deleteButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'error.requiresRecentLogin',
      );
    });

    it('shows another error on the first question and moves the focus to it', async () => {
      const { gateway, store } = renderScreen();
      gateway.deleteAccount.mockRejectedValue(
        authError('auth/network-request-failed'),
      );

      await userEvent.click(deleteButton());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('error.networkError');
      await waitFor(() => expect(alert).toHaveFocus());
      expect(deleteButton()).toBeEnabled();
      expect(status()).toBeEmptyDOMElement();
      expect(store.getState().exit.accountDeleted).toBe(false);
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        'deleteAccount failed: code=auth/network-request-failed uid=uid-1',
      );
    });
  });

  describe('an account with Google', () => {
    it('opens the Google window straight from the click and says where to continue', async () => {
      const { gateway } = renderScreen(googleUser);
      gateway.deleteAccount.mockReturnValue(new Promise(() => undefined));

      await userEvent.click(deleteButton());

      // No password and no step in between: the window must open from this click.
      expect(gateway.deleteAccount).toHaveBeenCalledWith({});
      expect(status()).toHaveTextContent('deleteAccount.deleting');
      expect(status()).toHaveTextContent('deleteAccount.googleWindowNotice');
      expect(deleteButton()).toBeDisabled();
    });

    it('deletes the account once Google confirmed', async () => {
      const { store } = renderScreen(googleUser);

      await userEvent.click(deleteButton());

      await waitFor(() =>
        expect(store.getState().exit.accountDeleted).toBe(true),
      );
    });

    it.each([
      ['closes the Google window', new AppAuthError(SIGN_IN_CANCELLED)],
      [
        'closes it (the code of the SDK)',
        authError('auth/popup-closed-by-user'),
      ],
      ['opens a second one', authError('auth/cancelled-popup-request')],
    ])('does nothing when the user %s', async (_what, error) => {
      const { gateway, store } = renderScreen(googleUser);
      gateway.deleteAccount.mockRejectedValue(error);

      await userEvent.click(deleteButton());

      await waitFor(() => expect(deleteButton()).toBeEnabled());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(status()).toBeEmptyDOMElement();
      expect(store.getState().exit.accountDeleted).toBe(false);
      expect(mockLogger.logError).not.toHaveBeenCalled();
      expect(mockLogger.logMessage).not.toHaveBeenCalled();
    });

    it.each([
      ['auth/user-mismatch', 'error.reauthUserMismatch'],
      ['auth/popup-blocked', 'error.popupBlocked'],
      // Not a reason to ask for a password: this account has none.
      ['auth/requires-recent-login', 'error.requiresRecentLogin'],
    ])('shows the error for %s', async (code, message) => {
      const { gateway } = renderScreen(googleUser);
      gateway.deleteAccount.mockRejectedValue(authError(code));

      await userEvent.click(deleteButton());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      await waitFor(() => expect(alert).toHaveFocus());
      expect(
        screen.queryByLabelText('deleteAccount.passwordLabel'),
      ).not.toBeInTheDocument();
      expect(deleteButton()).toBeEnabled();
    });

    it('asks Google, not the password, when the account has both', async () => {
      const { gateway } = renderScreen(userWith('password', 'google.com'));
      gateway.deleteAccount.mockReturnValue(new Promise(() => undefined));

      await userEvent.click(deleteButton());

      expect(status()).toHaveTextContent('deleteAccount.googleWindowNotice');
    });
  });

  describe('an account that cannot be confirmed on the web (Apple only)', () => {
    it('says where the account can be deleted instead of offering a button that cannot work', () => {
      const { gateway } = renderScreen(appleUser);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'drawerMenu.deleteAccount',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('deleteAccount.unavailableOnWeb'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'publicHome.deleteCardLink' }),
      ).toHaveAttribute('href', '/delete-account');
      // (the footer has the support address too)
      expect(
        within(screen.getByRole('main')).getByRole('link', {
          name: 'support@quadev.net',
        }),
      ).toHaveAttribute('href', 'mailto:support@quadev.net');
      expect(
        screen.getByRole('link', { name: 'forgotPassword.backToHomeLink' }),
      ).toHaveAttribute('href', '/account');
      expect(
        screen.queryByRole('button', { name: 'deleteAccount.deleteButton' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(gateway.deleteAccount).not.toHaveBeenCalled();
    });
  });
});
