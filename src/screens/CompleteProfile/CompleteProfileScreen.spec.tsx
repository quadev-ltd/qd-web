// Mirrors qd-mobile src/screens/CompleteProfile/CompleteProfileScreen.spec.tsx, plus what is
// different on the web: the header, and the form that stays in place while it saves.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CompleteProfileScreen } from './CompleteProfileScreen';
import { getPrefilledNames } from './useCompleteProfile';

import { type SessionUser } from '@/core/auth/types';
import {
  type SessionState,
  SessionStatus,
} from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const googleUser: SessionUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: null,
  providerIds: ['google.com'],
};

const session: Partial<SessionState> = {
  status: SessionStatus.NeedsProfile,
  authResolved: true,
  user: googleUser,
  profile: null,
  profileStatus: 'missing',
  providerNames: { firstName: 'Ada', lastName: 'Lovelace' },
};

const authError = (code: string) =>
  Object.assign(new Error(`[${code}] message`), { code });

const renderScreen = (overrides: Partial<SessionState> = {}) => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(<CompleteProfileScreen />, {
    gateway,
    route: '/complete-profile',
    session: { ...session, ...overrides },
  });
  return { gateway, ...utils };
};

const firstName = () => screen.getByLabelText('signUp.firstNameLabel');
const lastName = () => screen.getByLabelText('signUp.lastNameLabel');
const dateOfBirth = () => screen.getByLabelText('signUp.dobLabel');
const submitButton = () =>
  screen.getByRole('button', { name: 'completeProfile.submitButton' });

describe('CompleteProfileScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explains what is asked, and that the date of birth is optional', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'completeProfile.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('completeProfile.subtitle')).toBeInTheDocument();
    expect(firstName()).toHaveAttribute('autocomplete', 'given-name');
    expect(lastName()).toHaveAttribute('autocomplete', 'family-name');
    expect(dateOfBirth()).toHaveValue('');
    expect(submitButton()).toHaveAttribute('type', 'submit');
    expect(document.title).toBe('completeProfile.documentTitle');
  });

  it('prefills the names the provider sent and saves without a date of birth', async () => {
    const { gateway } = renderScreen();
    expect(firstName()).toHaveValue('Ada');
    expect(lastName()).toHaveValue('Lovelace');

    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(gateway.saveProfile).toHaveBeenCalledWith('uid-1', {
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires the missing last name (a provider that sent one name only)', async () => {
    const { gateway } = renderScreen({
      providerNames: { firstName: 'Ada' },
    });
    expect(lastName()).toHaveValue('');

    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(lastName()).toHaveAccessibleDescription(
        'fieldError.lastNameRequiredError',
      ),
    );
    expect(lastName()).toHaveAttribute('aria-invalid', 'true');
    // The first field with a mistake gets the focus.
    expect(lastName()).toHaveFocus();
    expect(gateway.saveProfile).not.toHaveBeenCalled();
  });

  it('requires both names when nothing is known', async () => {
    const { gateway } = renderScreen({ providerNames: null });

    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(firstName()).toHaveAccessibleDescription(
        'fieldError.firstNameRequiredError',
      ),
    );
    expect(lastName()).toHaveAccessibleDescription(
      'fieldError.lastNameRequiredError',
    );
    expect(firstName()).toHaveFocus();
    expect(gateway.saveProfile).not.toHaveBeenCalled();
  });

  it('saves the typed names, trimmed, and an entered date of birth as YYYY-MM-DD', async () => {
    const { gateway } = renderScreen({ providerNames: null });

    await userEvent.type(firstName(), ' Grace ');
    await userEvent.type(lastName(), ' Hopper ');
    // The field writes the slashes itself.
    await userEvent.type(dateOfBirth(), '09121906');
    expect(dateOfBirth()).toHaveValue('09/12/1906');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(gateway.saveProfile).toHaveBeenCalledWith('uid-1', {
        firstName: 'Grace',
        lastName: 'Hopper',
        dateOfBirth: '1906-12-09',
      }),
    );
  });

  it('rejects a date of birth that does not exist', async () => {
    const { gateway } = renderScreen();

    await userEvent.type(dateOfBirth(), '31022020');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(dateOfBirth()).toHaveAccessibleDescription(
        'fieldError.dobFormatError',
      ),
    );
    expect(gateway.saveProfile).not.toHaveBeenCalled();
  });

  // The app replaces the form with a spinner; here the form stays, disabled.
  it('keeps the form in place, disabled, while it saves', async () => {
    const { gateway } = renderScreen();
    gateway.saveProfile.mockReturnValue(new Promise(() => undefined));

    await userEvent.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(firstName()).toBeDisabled();
    expect(lastName()).toBeDisabled();
    expect(dateOfBirth()).toBeDisabled();
    expect(firstName()).toHaveValue('Ada');
  });

  it('stays busy after a successful save: the session leads to the next page', async () => {
    renderScreen();

    await userEvent.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error when saving fails, moves the focus to it and lets the user try again', async () => {
    const { gateway } = renderScreen();
    gateway.saveProfile.mockRejectedValue(authError('unavailable'));

    await userEvent.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('error.networkError');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(submitButton()).toBeEnabled();
    expect(firstName()).toBeEnabled();
    expect(firstName()).toHaveValue('Ada');
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('saveProfile failed: code=unavailable uid=uid-1'),
    );

    gateway.saveProfile.mockResolvedValue(undefined);
    await userEvent.click(submitButton());

    await waitFor(() => expect(gateway.saveProfile).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saves nothing when nobody is signed in any more', async () => {
    const { gateway } = renderScreen({ user: null });

    await userEvent.type(firstName(), 'Ada');
    await userEvent.click(submitButton());

    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(gateway.saveProfile).not.toHaveBeenCalled();
  });

  it.each([
    ['the prompt under the form', 'completeProfile.changePathButton'],
    ['the header', 'drawerMenu.signOut'],
  ])('lets the user sign out instead, from %s', async (_place, name) => {
    const { gateway, store } = renderScreen();
    expect(
      screen.getByText('completeProfile.changePathDescription', {
        exact: false,
      }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name }));

    expect(gateway.signOut).toHaveBeenCalledTimes(1);
    // The usual destination: the public home.
    expect(store.getState().exit.signedOutPath).toBeNull();
  });

  it('shows the email of the account in the header', () => {
    renderScreen();

    expect(screen.getByRole('banner')).toHaveTextContent('ada@example.com');
  });
});

describe('getPrefilledNames', () => {
  const user = (displayName: string | null): SessionUser => ({
    ...googleUser,
    displayName,
  });

  it('prefers the provider names, then the display name', () => {
    expect(
      getPrefilledNames(
        user('Augusta Ada King'),
        { firstName: 'Ada', lastName: 'Lovelace' },
        null,
      ),
    ).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(getPrefilledNames(user('Augusta Ada King'), null, null)).toEqual({
      firstName: 'Augusta',
      lastName: 'Ada King',
    });
  });

  it('prefers what the profile already has', () => {
    expect(
      getPrefilledNames(
        user('Augusta King'),
        { firstName: 'Ada', lastName: 'Lovelace' },
        { firstName: 'Grace', lastName: '' },
      ),
    ).toEqual({ firstName: 'Grace', lastName: 'Lovelace' });
  });

  it('gives nothing when nothing is known', () => {
    expect(getPrefilledNames(null, null, null)).toEqual({
      firstName: undefined,
      lastName: undefined,
    });
    expect(getPrefilledNames(user('  '), {}, null)).toEqual({
      firstName: undefined,
      lastName: undefined,
    });
  });

  it('cuts a name to the 30 characters the profile accepts', () => {
    expect(
      getPrefilledNames(user(null), { firstName: 'a'.repeat(40) }, null)
        .firstName,
    ).toBe('a'.repeat(30));
  });
});
