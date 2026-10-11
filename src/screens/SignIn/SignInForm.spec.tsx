// Mirrors qd-mobile src/screens/SignIn/SignInForm.spec.tsx, plus the validation errors, the
// loading state and the "not available yet" message.
import { zodResolver } from '@hookform/resolvers/zod';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';

import { SignInForm } from './SignInForm';

import { ACCOUNT_UNAVAILABLE, AppAuthError } from '@/core/auth/errors';
import { signInSchema, type SignInSchemaType } from '@/schemas/signInSchema';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const renderForm = () => {
  const gateway = createMockGateway();
  const Hooked = () => {
    const methods = useForm<SignInSchemaType>({
      resolver: zodResolver(signInSchema),
    });
    return (
      <FormProvider {...methods}>
        <SignInForm />
      </FormProvider>
    );
  };
  return { gateway, ...renderWithProviders(<Hooked />, { gateway }) };
};

const email = () => screen.getByLabelText('signIn.emailLabel');
const password = () => screen.getByLabelText('signIn.passwordLabel');
const submitButton = () =>
  screen.getByRole('button', { name: 'signIn.submitButton' });

const submit = async (
  values = { email: ' Ada@Example.com ', password: 'Secret1!' },
) => {
  await userEvent.type(email(), values.email);
  await userEvent.type(password(), values.password);
  await userEvent.click(submitButton());
};

describe('SignInForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the email and password fields and the submit button', () => {
    renderForm();

    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'current-password');
    expect(submitButton()).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('signs in with the trimmed, lower-case email; the session takes it from there', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockReturnValue(new Promise(() => undefined));

    await submit();

    await waitFor(() =>
      expect(gateway.signInWithEmail).toHaveBeenCalledWith(
        'ada@example.com',
        'Secret1!',
      ),
    );
  });

  it('signs in when Enter is pressed in a field', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockReturnValue(new Promise(() => undefined));

    await userEvent.type(email(), 'ada@example.com');
    await userEvent.type(password(), 'Secret1!{Enter}');

    await waitFor(() => expect(gateway.signInWithEmail).toHaveBeenCalled());
  });

  it('shows the required errors on the fields and does not call the gateway', async () => {
    const { gateway } = renderForm();

    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(email()).toHaveAccessibleDescription(
        'fieldError.emailRequiredError',
      ),
    );
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(password()).toHaveAccessibleDescription(
      'fieldError.passwordRequiredError',
    );
    expect(password()).toHaveAttribute('aria-invalid', 'true');
    expect(gateway.signInWithEmail).not.toHaveBeenCalled();
  });

  it('moves the focus to the first invalid field', async () => {
    renderForm();

    await userEvent.click(submitButton());

    await waitFor(() => expect(email()).toHaveFocus());
  });

  it.each([
    [
      'an invalid email',
      { email: 'invalid-email', password: 'Secret1!' },
      'signIn.emailLabel',
      'fieldError.emailFormatError',
    ],
    [
      'a password that breaks the rules',
      { email: 'ada@example.com', password: 'password' },
      'signIn.passwordLabel',
      'fieldError.passwordFormatError',
    ],
  ])('shows the format error for %s', async (_case, values, label, error) => {
    const { gateway } = renderForm();

    await submit(values);

    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(screen.getByLabelText(label)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(gateway.signInWithEmail).not.toHaveBeenCalled();
  });

  it('shows which password rules are not met while typing', async () => {
    renderForm();

    await userEvent.type(password(), 'secret1!');

    expect(
      screen.getByText('fieldError.passwordUppercaseError'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('fieldError.passwordLengthError'),
    ).not.toBeInTheDocument();
  });

  it('shows "invalid email or password" for auth/invalid-credential', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockRejectedValue({
      code: 'auth/invalid-credential',
    });

    await submit();

    expect(
      await screen.findByText('fieldError.invalidEmailOrPasswordError'),
    ).toBeInTheDocument();
    expect(email()).toHaveAccessibleDescription(
      'fieldError.invalidEmailOrPasswordError',
    );
    expect(email()).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it.each(['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'])(
    'shows %s on the email field',
    async code => {
      const { gateway } = renderForm();
      gateway.signInWithEmail.mockRejectedValue({ code });

      await submit();

      await waitFor(() =>
        expect(email()).toHaveAttribute('aria-invalid', 'true'),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('shows a message in the page for too many attempts', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockRejectedValue({
      code: 'auth/too-many-requests',
    });

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.tooManyRequestsError',
    );
    expect(email()).not.toHaveAttribute('aria-invalid');
  });

  it('says that sign-in is not available yet with the unavailable gateway', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockRejectedValue(
      new AppAuthError(ACCOUNT_UNAVAILABLE),
    );

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.accountUnavailable',
    );
    expect(mockLogger.logError).not.toHaveBeenCalled();
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      'signIn failed: code=app/account-unavailable',
    );
  });

  it('logs only the error code, never the email', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockRejectedValue({ code: 'auth/internal-error' });

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.unexpectedErrorRetry',
    );
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('signIn failed: code=auth/internal-error'),
    );
    expect(JSON.stringify(mockLogger.logError.mock.calls)).not.toContain(
      'example.com',
    );
  });

  it('disables the button and shows a spinner while signing in', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockReturnValue(new Promise(() => undefined));

    await submit();

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(submitButton()).toContainElement(screen.getByTestId('spinner'));
  });

  it('clears the page message when the user tries again', async () => {
    const { gateway } = renderForm();
    gateway.signInWithEmail.mockRejectedValueOnce({
      code: 'auth/network-request-failed',
    });
    gateway.signInWithEmail.mockReturnValueOnce(new Promise(() => undefined));

    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.networkError',
    );

    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });

  it('links to the forgot-password page', () => {
    renderForm();

    expect(
      screen.getByRole('link', { name: 'signIn.forgotButton' }),
    ).toHaveAttribute('href', '/forgot-password');
  });
});
