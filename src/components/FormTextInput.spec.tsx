import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FormTextInput } from './FormTextInput';

describe('FormTextInput', () => {
  it('names the field with a visible label', () => {
    render(<FormTextInput label="Email" type="email" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(screen.getByText('Email').tagName).toBe('LABEL');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('is a text field by default and passes the input attributes on', () => {
    render(
      <FormTextInput
        label="First name"
        autoComplete="given-name"
        placeholder="Ada"
      />,
    );

    const input = screen.getByLabelText('First name');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('autocomplete', 'given-name');
    expect(input).toHaveAttribute('placeholder', 'Ada');
  });

  it('reports what is typed', async () => {
    const onChange = vi.fn();
    render(<FormTextInput label="Email" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ab');

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('shows the error under the field and ties it to the field', () => {
    render(
      <FormTextInput
        label="Email"
        error={{ type: 'manual', message: 'Required' }}
      />,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
    expect(screen.getByText('Required')).toBeVisible();
  });

  it('ties the hint to the field, after the error', () => {
    render(
      <FormTextInput
        label="Password"
        hint="At least 8 characters"
        error={{ type: 'manual', message: 'Required' }}
      />,
    );

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Required At least 8 characters',
    );
  });

  it('shows the label action and the trailing control', () => {
    render(
      <FormTextInput
        label="Password"
        labelAction={<a href="/forgot-password">Forgot password?</a>}
        trailing={<button type="button">Show</button>}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });
});
