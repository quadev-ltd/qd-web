// Mirrors qd-mobile src/screens/SignUp/SignUpForm.spec.tsx, plus the terms checkbox, the
// loading state and the "not available yet" message.
import { zodResolver } from '@hookform/resolvers/zod';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';

import { SignUpForm } from './SignUpForm';

import { ACCOUNT_UNAVAILABLE, AppAuthError } from '@/core/auth/errors';
import {
  SignUpFields,
  signUpSchema,
  type SignUpSchemaType,
} from '@/schemas/signUpSchema';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

type TextField = Exclude<SignUpFields, SignUpFields.terms>;

const validData: Record<TextField, string> = {
  [SignUpFields.email]: ' Test@Test.com ',
  [SignUpFields.firstName]: 'John',
  [SignUpFields.lastName]: 'Doe',
  [SignUpFields.dob]: '29/02/2024',
  [SignUpFields.password]: 'Password123!',
  [SignUpFields.passwordConfirmation]: 'Password123!',
};

const inputLabels: Record<TextField, string> = {
  [SignUpFields.email]: 'signUp.emailLabel',
  [SignUpFields.firstName]: 'signUp.firstNameLabel',
  [SignUpFields.lastName]: 'signUp.lastNameLabel',
  [SignUpFields.dob]: 'signUp.dobLabel',
  [SignUpFields.password]: 'signUp.passwordLabel',
  [SignUpFields.passwordConfirmation]: 'signUp.passwordConfirmationLabel',
};

const textFields = Object.keys(inputLabels) as TextField[];

const authError = (code: string) =>
  Object.assign(new Error(`[${code}] message`), { code });

const user = userEvent.setup({ delay: null });

const renderComponent = () => {
  const gateway = createMockGateway();
  const HookedSignUpForm = () => {
    const methods = useForm<SignUpSchemaType>({
      resolver: zodResolver(signUpSchema),
    });
    return (
      <FormProvider {...methods}>
        <SignUpForm />
      </FormProvider>
    );
  };
  return { gateway, ...renderWithProviders(<HookedSignUpForm />, { gateway }) };
};

const field = (key: TextField) => screen.getByLabelText(inputLabels[key]);
const terms = () => screen.getByRole('checkbox');
const submitButton = () =>
  screen.getByRole('button', { name: 'signUp.submitButton' });

/** Fills every field (an `undefined` or empty override leaves that field untouched). */
const fillAndSubmit = async (
  overrides: Partial<Record<TextField, string | undefined>> = {},
  { agree = true } = {},
) => {
  const data = { ...validData, ...overrides };
  for (const key of textFields) {
    const value = data[key];
    if (value) {
      await user.type(field(key), value);
    }
  }
  if (agree) {
    await user.click(terms());
  }
  await user.click(submitButton());
};

describe('SignUpForm with the gateway', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render successfully', () => {
    renderComponent();

    expect(submitButton()).toHaveAttribute('type', 'submit');
    for (const key of textFields) {
      expect(field(key)).toBeInTheDocument();
    }
    expect(field(SignUpFields.firstName)).toHaveAttribute(
      'autocomplete',
      'given-name',
    );
    expect(field(SignUpFields.lastName)).toHaveAttribute(
      'autocomplete',
      'family-name',
    );
    expect(field(SignUpFields.password)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(terms()).not.toBeChecked();
    expect(screen.getByText('signUp.passwordHint')).toBeInTheDocument();
  });

  it('creates the account with a normalised email and an ISO date of birth', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockReturnValue(new Promise(() => undefined));

    await fillAndSubmit();

    await waitFor(() =>
      expect(gateway.signUpWithEmail).toHaveBeenCalledTimes(1),
    );
    expect(gateway.signUpWithEmail).toHaveBeenCalledWith(
      'test@test.com',
      'Password123!',
      { firstName: 'John', lastName: 'Doe', dateOfBirth: '2024-02-29' },
    );
  });

  it('creates the account without a date of birth when it is left empty (D16)', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockReturnValue(new Promise(() => undefined));

    await fillAndSubmit({ [SignUpFields.dob]: '' });

    await waitFor(() =>
      expect(gateway.signUpWithEmail).toHaveBeenCalledTimes(1),
    );
    expect(gateway.signUpWithEmail.mock.calls[0][2]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('trims the names', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockReturnValue(new Promise(() => undefined));

    await fillAndSubmit({
      [SignUpFields.firstName]: '  John ',
      [SignUpFields.lastName]: ' Doe  ',
    });

    await waitFor(() =>
      expect(gateway.signUpWithEmail).toHaveBeenCalledTimes(1),
    );
    expect(gateway.signUpWithEmail.mock.calls[0][2]).toMatchObject({
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('shows "email already in use" on the email field', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockRejectedValue(
      authError('auth/email-already-in-use'),
    );

    await fillAndSubmit();

    expect(
      await screen.findByText('fieldError.emailAlreadyUsedError'),
    ).toBeInTheDocument();
    expect(field(SignUpFields.email)).toHaveAccessibleDescription(
      'fieldError.emailAlreadyUsedError',
    );
    expect(field(SignUpFields.email)).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('shows the password policy error on the password field', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockRejectedValue(
      authError('auth/password-does-not-meet-requirements'),
    );

    await fillAndSubmit();

    expect(
      await screen.findByText('fieldError.passwordNotComplexError'),
    ).toBeInTheDocument();
    expect(field(SignUpFields.password)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a message in the page and logs only the error code for unknown errors', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockRejectedValue(authError('auth/internal-error'));

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.unexpectedErrorRetry',
    );
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('signUp failed: code=auth/internal-error'),
    );
    const logged = JSON.stringify(mockLogger.logError.mock.calls);
    expect(logged).not.toContain('test@test.com');
    expect(logged).not.toContain('John');
  });

  it('shows a network error in the page', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockRejectedValue(
      authError('auth/network-request-failed'),
    );

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.networkError',
    );
  });

  it('says that sign-in is not available yet with the unavailable gateway', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockRejectedValue(
      new AppAuthError(ACCOUNT_UNAVAILABLE),
    );

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.accountUnavailable',
    );
    expect(mockLogger.logError).not.toHaveBeenCalled();
  });

  it('disables the button and shows a spinner while the account is created', async () => {
    const { gateway } = renderComponent();
    gateway.signUpWithEmail.mockReturnValue(new Promise(() => undefined));

    await fillAndSubmit();

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveAttribute('aria-busy', 'true');
    expect(submitButton()).toContainElement(screen.getByTestId('spinner'));
  });
});

describe('SignUpForm individual errors', () => {
  // two days in the future
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 2);
  const day = futureDate.getDate().toString().padStart(2, '0');
  const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
  const year = futureDate.getFullYear();
  const futureDateString = `${day}/${month}/${year}`;
  const testCases: {
    testFieldKey: TextField;
    testFieldValue: string | undefined;
    expectedError: string;
  }[] = [
    {
      testFieldKey: SignUpFields.email,
      testFieldValue: undefined,
      expectedError: 'emailRequiredError',
    },
    {
      testFieldKey: SignUpFields.email,
      testFieldValue: 'invalid-email',
      expectedError: 'emailFormatError',
    },
    {
      testFieldKey: SignUpFields.firstName,
      testFieldValue: undefined,
      expectedError: 'firstNameRequiredError',
    },
    {
      testFieldKey: SignUpFields.firstName,
      testFieldValue:
        'This is a very long name to trigger the length in the name field',
      expectedError: 'firstNameLengthError',
    },
    {
      testFieldKey: SignUpFields.lastName,
      testFieldValue: undefined,
      expectedError: 'lastNameRequiredError',
    },
    {
      testFieldKey: SignUpFields.lastName,
      testFieldValue:
        'This is a very long last name to trigger the length in the name field',
      expectedError: 'lastNameLengthError',
    },
    {
      testFieldKey: SignUpFields.dob,
      testFieldValue: '2000/12/12',
      expectedError: 'dobFormatError',
    },
    {
      testFieldKey: SignUpFields.dob,
      testFieldValue: '12/0',
      expectedError: 'dobFormatError',
    },
    {
      testFieldKey: SignUpFields.dob,
      testFieldValue: futureDateString,
      expectedError: 'dobFutureError',
    },
    {
      testFieldKey: SignUpFields.password,
      testFieldValue: undefined,
      expectedError: 'passwordRequiredError',
    },
    {
      testFieldKey: SignUpFields.password,
      testFieldValue: 'password',
      expectedError: 'passwordFormatError',
    },
    {
      testFieldKey: SignUpFields.passwordConfirmation,
      testFieldValue: undefined,
      expectedError: 'passwordConfirmationRequiredError',
    },
    {
      testFieldKey: SignUpFields.passwordConfirmation,
      testFieldValue: 'password',
      expectedError: 'passwordConfirmationMatchError',
    },
  ];

  it.each(testCases)(
    'should render $expectedError for $testFieldKey with value $testFieldValue',
    async ({ testFieldKey, testFieldValue, expectedError }) => {
      const { gateway } = renderComponent();

      await fillAndSubmit({ [testFieldKey]: testFieldValue });

      expect(
        await screen.findByText(`fieldError.${expectedError}`),
      ).toBeInTheDocument();
      expect(field(testFieldKey)).toHaveAttribute('aria-invalid', 'true');
      expect(field(testFieldKey)).toHaveAccessibleDescription(
        expect.stringContaining(`fieldError.${expectedError}`),
      );
      expect(gateway.signUpWithEmail).not.toHaveBeenCalled();
    },
  );

  it('should render required errors', async () => {
    renderComponent();

    await user.click(submitButton());

    expect(
      await screen.findByText('fieldError.emailRequiredError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.firstNameRequiredError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.lastNameRequiredError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.passwordRequiredError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.passwordConfirmationRequiredError'),
    ).toBeInTheDocument();
    expect(field(SignUpFields.dob)).not.toHaveAttribute('aria-invalid');
  });

  it('asks to agree to the terms before creating the account', async () => {
    const { gateway } = renderComponent();

    await fillAndSubmit({}, { agree: false });

    expect(
      await screen.findByText('fieldError.termsRequiredError'),
    ).toBeInTheDocument();
    expect(terms()).toHaveAttribute('aria-invalid', 'true');
    expect(terms()).toHaveAccessibleDescription(
      'fieldError.termsRequiredError',
    );
    expect(gateway.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('asks again when the agreement is taken back', async () => {
    const { gateway } = renderComponent();

    await user.click(terms());
    await user.click(terms());
    await fillAndSubmit({}, { agree: false });

    expect(
      await screen.findByText('fieldError.termsRequiredError'),
    ).toBeInTheDocument();
    expect(gateway.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('writes the date of birth as DD/MM/YYYY while typing', async () => {
    renderComponent();

    await user.type(field(SignUpFields.dob), '29022024');

    expect(field(SignUpFields.dob)).toHaveValue('29/02/2024');
  });

  it('links to the terms and the privacy policy in a new tab', () => {
    renderComponent();

    const termsLink = screen.getByRole('link', {
      name: 'signUp.termsOfService',
    });
    const privacyLink = screen.getByRole('link', {
      name: 'signUp.privacyPolicy',
    });
    expect(termsLink).toHaveAttribute('href', '/terms-and-conditions');
    expect(termsLink).toHaveAttribute('target', '_blank');
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy');
    expect(privacyLink).toHaveAttribute('target', '_blank');
  });
});
