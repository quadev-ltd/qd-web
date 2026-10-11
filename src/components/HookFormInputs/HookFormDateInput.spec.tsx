import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';

import { HookFormDateInput } from './HookFormDateInput';

import { SignUpFields, type SignUpSchemaType } from '@/schemas/signUpSchema';

const TestComponent: React.FC<{ error?: string }> = ({ error }) => {
  const { control } = useForm<SignUpSchemaType>();
  const value = useWatch({ control, name: SignUpFields.dob });
  return (
    <>
      <HookFormDateInput<SignUpSchemaType>
        label="date of birth"
        placeholder="DD/MM/YYYY"
        name={SignUpFields.dob}
        control={control}
        error={error ? { type: 'manual', message: error } : undefined}
      />
      <output>{`value=${value ?? ''}`}</output>
    </>
  );
};

describe('HookFormDateInput', () => {
  it('is a labelled text field with a numeric keyboard', () => {
    render(<TestComponent />);

    const input = screen.getByLabelText('date of birth');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('placeholder', 'DD/MM/YYYY');
    expect(input).toHaveValue('');
  });

  it('writes the digits typed as DD/MM/YYYY, in the field and in the form', async () => {
    render(<TestComponent />);

    await userEvent.type(screen.getByLabelText('date of birth'), '29022024');

    expect(screen.getByLabelText('date of birth')).toHaveValue('29/02/2024');
    expect(screen.getByText('value=29/02/2024')).toBeInTheDocument();
  });

  it('accepts the slashes when they are typed, and ignores extra digits', async () => {
    render(<TestComponent />);

    await userEvent.type(screen.getByLabelText('date of birth'), '29/02/20249');

    expect(screen.getByLabelText('date of birth')).toHaveValue('29/02/2024');
  });

  it('can be emptied again', async () => {
    render(<TestComponent />);
    const input = screen.getByLabelText('date of birth');
    await userEvent.type(input, '2902');

    await userEvent.clear(input);

    expect(input).toHaveValue('');
    expect(screen.getByText('value=')).toBeInTheDocument();
  });

  it('shows its error', () => {
    render(<TestComponent error="fieldError.dobFormatError" />);

    const input = screen.getByLabelText('date of birth');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('fieldError.dobFormatError');
  });
});
