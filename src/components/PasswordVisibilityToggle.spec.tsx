import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PasswordVisibilityToggle from './PasswordVisibilityToggle';

describe('PasswordVisibilityToggle', () => {
  it('offers to show a hidden password', async () => {
    const onToggle = vi.fn();
    render(
      <PasswordVisibilityToggle
        isPasswordVisible={false}
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole('button', {
      name: 'password.showAccessibilityLabel',
    });
    expect(button).toHaveTextContent('password.showButton');
    // Inside a form it must not send the form.
    expect(button).toHaveAttribute('type', 'button');

    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers to hide a visible password', () => {
    render(<PasswordVisibilityToggle isPasswordVisible onToggle={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'password.hideAccessibilityLabel' }),
    ).toHaveTextContent('password.hideButton');
  });

  it('names the confirmation field’s button apart from the password’s', () => {
    const { rerender } = render(
      <PasswordVisibilityToggle
        isPasswordVisible={false}
        onToggle={vi.fn()}
        confirmation
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'password.showConfirmationAccessibilityLabel',
      }),
    ).toHaveTextContent('password.showButton');

    rerender(
      <PasswordVisibilityToggle
        isPasswordVisible
        onToggle={vi.fn()}
        confirmation
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'password.hideConfirmationAccessibilityLabel',
      }),
    ).toHaveTextContent('password.hideButton');
  });
});
