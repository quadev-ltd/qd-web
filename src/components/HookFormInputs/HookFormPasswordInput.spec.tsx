// Mirrors qd-mobile src/components/HookFormInputs/HookFormPasswordInput.spec.tsx (the live
// hints), plus the show/hide button, the confirmation field and the forgot-password link.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import { HookFormPasswordInput } from './HookFormPasswordInput';

import { SignUpFields, type SignUpSchemaType } from '@/schemas/signUpSchema';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

interface TestProps {
  password?: string;
  hint?: string;
  withConfirmation?: boolean;
  withForgotPassword?: boolean;
}
const TestComponent: React.FC<TestProps> = ({
  password,
  hint,
  withConfirmation,
  withForgotPassword,
}) => {
  const { control } = useForm<SignUpSchemaType>();
  return (
    <HookFormPasswordInput<SignUpSchemaType>
      label="password"
      name={SignUpFields.password}
      password={password}
      control={control}
      hint={hint}
      forgotPasswordLink={
        withForgotPassword
          ? { label: 'forgot', to: '/forgot-password' }
          : undefined
      }
      passwordConfirmationField={
        withConfirmation
          ? {
              label: 'confirmation',
              name: SignUpFields.passwordConfirmation,
            }
          : undefined
      }
    />
  );
};

const HINTS = [
  'fieldError.passwordUppercaseError',
  'fieldError.passwordLowercaseError',
  'fieldError.passwordNumberError',
  'fieldError.passwordSpecialCharacterError',
  'fieldError.passwordLengthError',
];

describe('HookFormPasswordInput', () => {
  it('should show special character error hint and hide it', () => {
    const { rerender } = renderWithProviders(
      <TestComponent password="Password123" />,
    );
    expect(
      screen.getByText('fieldError.passwordSpecialCharacterError'),
    ).toBeInTheDocument();

    rerender(<TestComponent password="Password123!" />);
    expect(
      screen.queryByText('fieldError.passwordSpecialCharacterError'),
    ).not.toBeInTheDocument();
  });

  it('should show length error and then hide it', () => {
    const { rerender } = renderWithProviders(
      <TestComponent password="Aaa123!" />,
    );
    expect(
      screen.getByText('fieldError.passwordLengthError'),
    ).toBeInTheDocument();

    rerender(<TestComponent password="Aaaa123!" />);
    expect(
      screen.queryByText('fieldError.passwordLengthError'),
    ).not.toBeInTheDocument();
  });

  it('should show lower upper case error and then hide it', () => {
    const { rerender } = renderWithProviders(
      <TestComponent password="AAAA123!" />,
    );
    expect(
      screen.getByText('fieldError.passwordLowercaseError'),
    ).toBeInTheDocument();

    rerender(<TestComponent password="AAAa123!" />);
    expect(
      screen.queryByText('fieldError.passwordLowercaseError'),
    ).not.toBeInTheDocument();
  });

  it('should show number error and then hide it', () => {
    const { rerender } = renderWithProviders(
      <TestComponent password="Aaaaaaa!" />,
    );
    expect(
      screen.getByText('fieldError.passwordNumberError'),
    ).toBeInTheDocument();

    rerender(<TestComponent password="Aaaaaaa1!" />);
    expect(
      screen.queryByText('fieldError.passwordNumberError'),
    ).not.toBeInTheDocument();
  });

  it('should show errors and then hide it', () => {
    const { rerender } = renderWithProviders(
      <TestComponent password="aaaaaaa" />,
    );
    expect(
      screen.getByText('fieldError.passwordNumberError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.passwordUppercaseError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.passwordLengthError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('fieldError.passwordSpecialCharacterError'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('fieldError.passwordLowercaseError'),
    ).not.toBeInTheDocument();

    rerender(<TestComponent password="Aaaaaaa1!" />);

    for (const hint of HINTS) {
      expect(screen.queryByText(hint)).not.toBeInTheDocument();
    }
  });

  it('shows no hint before anything is typed', () => {
    renderWithProviders(<TestComponent />);

    for (const hint of HINTS) {
      expect(screen.queryByText(hint)).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('password')).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('ties the unmet rules to the field', () => {
    renderWithProviders(<TestComponent password="Password123" />);

    expect(screen.getByLabelText('password')).toHaveAccessibleDescription(
      'fieldError.passwordSpecialCharacterError',
    );
  });

  it('shows the given hint until the user types, then the unmet rules', () => {
    const { rerender } = renderWithProviders(
      <TestComponent hint="the rules" />,
    );
    expect(screen.getByLabelText('password')).toHaveAccessibleDescription(
      'the rules',
    );

    rerender(<TestComponent hint="the rules" password="a" />);
    expect(screen.queryByText('the rules')).not.toBeInTheDocument();
    expect(
      screen.getByText('fieldError.passwordLengthError'),
    ).toBeInTheDocument();

    rerender(<TestComponent hint="the rules" password="Password123!" />);
    expect(screen.queryByText('the rules')).not.toBeInTheDocument();
  });

  it('hides the password until the show button is pressed, and hides it again', async () => {
    renderWithProviders(<TestComponent />);
    const input = screen.getByLabelText('password');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(
      screen.getByRole('button', { name: 'password.showAccessibilityLabel' }),
    );

    expect(input).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', {
      name: 'password.hideAccessibilityLabel',
    });
    expect(hide).toHaveTextContent('password.hideButton');

    await userEvent.click(hide);

    expect(input).toHaveAttribute('type', 'password');
    expect(
      screen.getByRole('button', { name: 'password.showAccessibilityLabel' }),
    ).toHaveTextContent('password.showButton');
  });

  it('does not submit the form when the show button is pressed', () => {
    renderWithProviders(<TestComponent />);

    expect(
      screen.getByRole('button', { name: 'password.showAccessibilityLabel' }),
    ).toHaveAttribute('type', 'button');
  });

  it('shows and hides the password and the confirmation each on its own', async () => {
    renderWithProviders(<TestComponent withConfirmation />);
    const password = screen.getByLabelText('password');
    const confirmation = screen.getByLabelText('confirmation');
    expect(confirmation).toHaveAttribute('type', 'password');

    await userEvent.click(
      screen.getByRole('button', {
        name: 'password.showConfirmationAccessibilityLabel',
      }),
    );

    expect(confirmation).toHaveAttribute('type', 'text');
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.click(
      screen.getByRole('button', { name: 'password.showAccessibilityLabel' }),
    );

    expect(password).toHaveAttribute('type', 'text');
    expect(confirmation).toHaveAttribute('type', 'text');

    await userEvent.click(
      screen.getByRole('button', {
        name: 'password.hideConfirmationAccessibilityLabel',
      }),
    );

    expect(confirmation).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'password.hideAccessibilityLabel' }),
    ).toBeInTheDocument();
  });

  it('keeps what is typed in each field', async () => {
    renderWithProviders(<TestComponent withConfirmation />);

    await userEvent.type(screen.getByLabelText('password'), 'Password123!');
    await userEvent.type(screen.getByLabelText('confirmation'), 'Other123!');

    expect(screen.getByLabelText('password')).toHaveValue('Password123!');
    expect(screen.getByLabelText('confirmation')).toHaveValue('Other123!');
  });

  it('links to the forgot-password page when asked', () => {
    renderWithProviders(<TestComponent withForgotPassword />);

    expect(screen.getByRole('link', { name: 'forgot' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
