// Mirrors qd-mobile src/screens/ForgotPassword/ForgotPasswordForm.spec.tsx, plus the
// validation errors and the "not available yet" message.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ForgotPasswordForm from './ForgotPasswordForm';

import { ACCOUNT_UNAVAILABLE, AppAuthError } from '@/core/auth/errors';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const renderForm = (defaultEmail = '') => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(
    <ForgotPasswordForm
      emailLabel="email"
      defaultEmail={defaultEmail}
      submitLabel="submit"
      backPath="/sign-in"
      backLabel="back"
    />,
    { gateway },
  );
  return { gateway, ...utils };
};

const submit = async (email: string) => {
  if (email) {
    await userEvent.type(screen.getByLabelText('email'), email);
  }
  await userEvent.click(screen.getByRole('button', { name: 'submit' }));
};

describe('ForgotPasswordForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explains what will happen', () => {
    renderForm();

    expect(screen.getByText('forgotPassword.subtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('email')).toHaveAttribute('type', 'email');
  });

  it('sends the reset email and shows the neutral message', async () => {
    const { gateway } = renderForm();
    gateway.sendPasswordReset.mockResolvedValue(undefined);

    await submit(' Ada@Example.com ');

    expect(await screen.findByText('forgotPassword.success')).toBeVisible();
    expect(gateway.sendPasswordReset).toHaveBeenCalledWith('ada@example.com');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-icon-check')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'back' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('shows the same neutral message when no account exists', async () => {
    const { gateway } = renderForm();
    gateway.sendPasswordReset.mockRejectedValue({
      code: 'auth/user-not-found',
    });

    await submit('nobody@example.com');

    expect(await screen.findByText('forgotPassword.success')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'forgotPassword.tryAgain' }),
    ).not.toBeInTheDocument();
    expect(mockLogger.logError).not.toHaveBeenCalled();
    expect(mockLogger.logMessage).not.toHaveBeenCalled();
  });

  it('shows a network error and lets the user try again', async () => {
    const { gateway } = renderForm();
    gateway.sendPasswordReset.mockRejectedValue({
      code: 'auth/network-request-failed',
    });

    await submit('ada@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.networkError',
    );
    expect(screen.getByTestId('status-icon-error')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'back' }),
    ).not.toBeInTheDocument();
    const tryAgain = screen.getByRole('button', {
      name: 'forgotPassword.tryAgain',
    });
    await waitFor(() => expect(tryAgain).toHaveFocus());
    await userEvent.click(
      screen.getByRole('button', { name: 'forgotPassword.tryAgain' }),
    );
    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument();
    expect(screen.getByLabelText('email')).toHaveValue('ada@example.com');
  });

  it('says that sign-in is not available yet with the unavailable gateway', async () => {
    const { gateway } = renderForm();
    gateway.sendPasswordReset.mockRejectedValue(
      new AppAuthError(ACCOUNT_UNAVAILABLE),
    );

    await submit('ada@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.accountUnavailable',
    );
  });

  // The app replaces the form with a spinner; here the form stays, disabled.
  it('keeps the form in place, disabled, while the email is being sent', async () => {
    const { gateway } = renderForm();
    gateway.sendPasswordReset.mockReturnValue(new Promise(() => undefined));

    await submit('ada@example.com');

    const button = screen.getByRole('button', { name: 'submit' });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.getByLabelText('email')).toBeDisabled();
    expect(screen.getByLabelText('email')).toHaveValue('ada@example.com');
    expect(screen.getByRole('status')).toHaveTextContent(
      'forgotPassword.sending',
    );
    expect(
      screen.queryByText('forgotPassword.success'),
    ).not.toBeInTheDocument();
  });

  it('lets the user send another link, and moves the focus to that button', async () => {
    renderForm();

    await submit('ada@example.com');

    const repeat = await screen.findByRole('button', {
      name: 'forgotPassword.repeat',
    });
    await waitFor(() => expect(repeat).toHaveFocus());

    await userEvent.click(repeat);

    expect(screen.getByRole('button', { name: 'submit' })).toBeInTheDocument();
  });

  // As in the app, the field starts as an empty text (not as "nothing"), so an empty
  // submit reports the format error.
  it.each([
    ['', 'fieldError.emailFormatError'],
    ['invalid-email', 'fieldError.emailFormatError'],
  ])('rejects the email %j with %s', async (email, error) => {
    const { gateway } = renderForm();

    await submit(email);

    await waitFor(() =>
      expect(screen.getByLabelText('email')).toHaveAccessibleDescription(error),
    );
    expect(screen.getByLabelText('email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(gateway.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('starts with the email it is given', async () => {
    const { gateway } = renderForm('ada@example.com');
    expect(screen.getByLabelText('email')).toHaveValue('ada@example.com');

    await submit('');

    await waitFor(() =>
      expect(gateway.sendPasswordReset).toHaveBeenCalledWith('ada@example.com'),
    );
  });
});
